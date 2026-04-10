import atexit
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SERVICE_DIRS = [
    ROOT / "services" / "identity-service",
    ROOT / "services" / "ingestion-simulator",
    ROOT / "services" / "tracking-service",
    ROOT / "services" / "matching-service",
    ROOT / "services" / "trip-service",
]
FRONTEND_DIR = ROOT / "services" / "frontend-dashboard"

PORT_CHECKS = [
    ("Kafka", "127.0.0.1", 29092),
    ("Redis", "127.0.0.1", 6379),
    ("MongoDB", "127.0.0.1", 27017),
    ("Prometheus", "127.0.0.1", 9090),
    ("Grafana", "127.0.0.1", 3000),
]
# 1.2s balances quick readiness checks with avoiding tight retry loops during docker startup.
PORT_CHECK_INTERVAL = 1.2
# 0.6s gives Node services a short head start before launching the next one to reduce startup churn.
SERVICE_STARTUP_DELAY = 0.6
PENDING_WRITES_KEY = "pending_writes"


def is_windows():
    return os.name == "nt"


def resolve_cmd(name: str) -> str:
    if is_windows():
        if name == "npm":
            path = shutil.which("npm.cmd") or shutil.which("npm")
            if not path:
                raise FileNotFoundError("npm not found. Install Node.js and add to PATH.")
            return path
        if name == "docker":
            path = shutil.which("docker.exe") or shutil.which("docker")
            if not path:
                raise FileNotFoundError("docker not found. Install Docker Desktop and add to PATH.")
            return path
        return shutil.which(name) or name
    path = shutil.which(name)
    if not path:
        raise FileNotFoundError(f"{name} not found in PATH.")
    return path


def run_blocking(cmd, cwd=None):
    print(f"\n[RUN] {' '.join(cmd)} (cwd={cwd})")
    result = subprocess.run(cmd, cwd=str(cwd) if cwd else None, shell=False)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}")


def run_capture(cmd, cwd=None):
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        shell=False,
        check=False,
        text=True,
        capture_output=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def wait_for_port(name, host, port, timeout=90):
    print(f"[WAIT] {name} on {host}:{port} ...")
    start = time.time()
    while time.time() - start < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            try:
                s.connect((host, port))
                print(f"[OK] {name} is up")
                return True
            except OSError:
                time.sleep(PORT_CHECK_INTERVAL)
    print(f"[WARN] {name} not reachable on {host}:{port}")
    return False


def discover_projects(paths):
    found = []
    for p in paths:
        if p.exists() and (p / "package.json").exists():
            found.append(p)
        else:
            print(f"[SKIP] Missing package.json/path: {p}")
    return found


def read_scripts(project_dir: Path):
    pkg = project_dir / "package.json"
    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
        return data.get("scripts", {})
    except Exception:
        return {}


def pick_run_script(project_dir: Path):
    scripts = read_scripts(project_dir)
    if "start" in scripts:
        return "start"
    if "dev" in scripts:
        return "dev"
    return None


class ProcessManager:
    def __init__(self):
        self._procs = {}

    def start(self, name: str, cwd: Path, npm_cmd: str, script_name: str):
        if name in self._procs and self._procs[name].poll() is None:
            print(f"[INFO] {name} already running.")
            return

        if is_windows():
            # CREATE_NEW_CONSOLE separates UI windows while CREATE_NEW_PROCESS_GROUP
            # isolates child-service signal handling from the controller console.
            flags = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP
            proc = subprocess.Popen(
                [npm_cmd, "run", script_name],
                cwd=str(cwd),
                creationflags=flags,
                shell=False,
            )
        else:
            proc = subprocess.Popen(
                [npm_cmd, "run", script_name],
                cwd=str(cwd),
                preexec_fn=os.setsid,
                shell=False,
            )

        self._procs[name] = proc
        print(f"[START] {name} via npm run {script_name} (pid={proc.pid})")

    def stop(self, name: str):
        proc = self._procs.get(name)
        if not proc:
            return

        if proc.poll() is not None:
            print(f"[INFO] {name} already stopped.")
            return

        try:
            if is_windows():
                subprocess.run(
                    ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                    check=False,
                    capture_output=True,
                    text=True,
                )
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception as exc:
            print(f"[WARN] Failed stopping {name}: {exc}")
        finally:
            print(f"[STOP] {name}")

    def stop_all(self):
        for name in list(self._procs.keys()):
            self.stop(name)

    def status(self):
        rows = []
        for name, proc in self._procs.items():
            running = proc.poll() is None
            rows.append((name, "running" if running else "stopped", proc.pid))
        return rows


def open_dashboards():
    print("[OPEN] Prometheus: http://localhost:9090")
    print("[OPEN] Grafana: http://localhost:3000")
    try:
        webbrowser.open("http://localhost:9090", new=2)
        webbrowser.open("http://localhost:3000", new=2)
    except Exception:
        pass


def trigger_circuit_breaker(docker_cmd: str):
    print("\n=== Trigger Circuit Breaker ===")
    run_blocking([docker_cmd, "compose", "stop", "mongo"], cwd=ROOT)
    time.sleep(2)

    ride_id = f"ride-circuit-breaker-{int(time.time())}"
    payload = json.dumps(
        {
            "ride_id": ride_id,
            "driver_id": "driver-001",
            "rider_id": "rider-001",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:4005/accept-ride",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print(f"[OK] /accept-ride response: {body}")
    except urllib.error.URLError as exc:
        print(f"[WARN] Failed POST /accept-ride: {exc}")

    code, out, err = run_capture(
        [docker_cmd, "compose", "exec", "-T", "redis", "redis-cli", "LRANGE", PENDING_WRITES_KEY, "0", "-1"],
        cwd=ROOT,
    )
    if code == 0:
        print(f"[INFO] Redis {PENDING_WRITES_KEY}:")
        print(out or "(empty)")
    else:
        print(f"[WARN] Could not query redis pending_writes: {err or out}")

    run_blocking([docker_cmd, "compose", "start", "mongo"], cwd=ROOT)
    wait_for_port("MongoDB", "127.0.0.1", 27017, timeout=60)
    print("=== Circuit breaker flow complete ===")


def start_infra(docker_cmd: str):
    compose_file = ROOT / "docker-compose.yml"
    if compose_file.exists():
        run_blocking([docker_cmd, "compose", "up", "-d"], cwd=ROOT)
        for name, host, port in PORT_CHECKS:
            wait_for_port(name, host, port)
        open_dashboards()
    else:
        print("[WARN] No docker-compose.yml found, skipping infra start.")


def install_dependencies(projects, npm_cmd):
    for p in projects:
        run_blocking([npm_cmd, "install"], cwd=p)


def start_services(projects, npm_cmd, manager: ProcessManager, include_frontend=True):
    for p in (x for x in projects if x != FRONTEND_DIR):
        script = pick_run_script(p)
        if not script:
            print(f"[SKIP] No start/dev script in {p.name}")
            continue
        manager.start(p.name, p, npm_cmd, script)
        time.sleep(SERVICE_STARTUP_DELAY)

    if include_frontend and FRONTEND_DIR in projects:
        script = pick_run_script(FRONTEND_DIR)
        if script:
            manager.start(FRONTEND_DIR.name, FRONTEND_DIR, npm_cmd, script)
        else:
            print("[SKIP] Frontend has no start/dev script.")


def print_menu():
    print("\n=== Controller Menu ===")
    print("1) Trigger circuit breaker flow")
    print("2) Open Prometheus + Grafana dashboards")
    print("3) Show started service status")
    print("4) Restart backend + frontend services")
    print("5) Stop all started services")
    print("0) Exit")


def main():
    print("=== Project Velocity Controller ===")
    print(f"[INFO] ROOT={ROOT}")

    docker_cmd = resolve_cmd("docker")
    npm_cmd = resolve_cmd("npm")

    projects = discover_projects(SERVICE_DIRS + [FRONTEND_DIR])
    if not projects:
        raise RuntimeError("No projects found with package.json.")

    manager = ProcessManager()

    def cleanup():
        print("\n[CLEANUP] Stopping started services...")
        manager.stop_all()

    atexit.register(cleanup)
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    start_infra(docker_cmd)
    install_dependencies(projects, npm_cmd)
    start_services(projects, npm_cmd, manager, include_frontend=True)

    while True:
        print_menu()
        choice = input("Select option: ").strip()

        if choice == "1":
            trigger_circuit_breaker(docker_cmd)
        elif choice == "2":
            open_dashboards()
        elif choice == "3":
            rows = manager.status()
            if not rows:
                print("[INFO] No services launched by controller yet.")
            else:
                for name, state, pid in rows:
                    print(f"- {name}: {state} (pid={pid})")
        elif choice == "4":
            manager.stop_all()
            start_services(projects, npm_cmd, manager, include_frontend=True)
        elif choice == "5":
            manager.stop_all()
        elif choice == "0":
            print("[EXIT] Controller exiting.")
            break
        else:
            print("[WARN] Invalid option.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[FAILED] {e}")
        sys.exit(1)
