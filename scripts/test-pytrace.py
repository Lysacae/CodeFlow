import json
import subprocess
import sys
from pathlib import Path

root = Path(r"C:\Users\lysac\Documents\Project\CodeFlow\.tmp-assets\pytrace")
root.mkdir(parents=True, exist_ok=True)
(root / "main.py").write_text("a = 2\nb = 3\nprint(a + b)\n", encoding="utf-8")
tracer = r'''
import json, sys
src = open("main.py", encoding="utf-8").read()
events = []

def snap(frame):
    out = []
    for k, v in list(frame.f_locals.items())[:24]:
        if str(k).startswith("__"):
            continue
        try:
            out.append({"name": str(k), "type": type(v).__name__, "value": repr(v)[:160]})
        except Exception:
            out.append({"name": str(k), "type": "?", "value": "?"})
    return out

def tracer(frame, event, arg):
    filename = frame.f_code.co_filename.replace("\\", "/")
    if filename.endswith("main.py") and event in ("line", "call", "return") and len(events) < 500:
        events.append({
            "line": frame.f_lineno,
            "event": event,
            "function": frame.f_code.co_name,
            "locals": [] if event == "call" else snap(frame),
            "returned": None if event != "return" else repr(arg)[:160],
        })
    return tracer

sys.settrace(tracer)
namespace = {"__name__": "__main__"}
try:
    exec(compile(src, "main.py", "exec"), namespace, namespace)
except SystemExit:
    pass
except Exception as exc:
    sys.stderr.write("%s: %s\n" % (type(exc).__name__, exc))
finally:
    sys.settrace(None)
    with open("trace.json", "w", encoding="utf-8") as handle:
        json.dump(events, handle, ensure_ascii=False)
'''
(root / "cf_trace.py").write_text(tracer, encoding="utf-8")
subprocess.check_call([sys.executable, "cf_trace.py"], cwd=root)
events = json.loads((root / "trace.json").read_text(encoding="utf-8"))
lines = [event["line"] for event in events if event["event"] == "line"]
assert lines[:3] == [1, 2, 3], lines
seen = {item["name"]: item["value"] for event in events for item in event["locals"]}
assert seen.get("a") == "2", seen
assert seen.get("b") == "3", seen
print("python trace ok", len(events), "events")
