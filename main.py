#!/usr/bin/python3

from json import dumps, loads
import subprocess

import sys
from os.path import dirname
sys.path.append(dirname(__file__))

from data import Selection

def log(message):
    with open("/home/kaineer/tmp/plugin.log", "a") as f:
        f.write(message + "\n")

def send(object):
    try:
        print(dumps(object))
    except Exception:
        log("[ERROR] failed to send response to Pop Shell")

def get_event():
    line = input()

    try:
        return loads(line)
    except Exception:
        log("[ERROR] Input not valid JSON")
        return None

def send_event(name, **kw):
    send({"event": name, **kw})

def create_plugin():
    shell_only = False
    last_query = ""

    def complete(ev):
        send_event("noop")

    def query(ev):
        nonlocal last_query

        value = ev["value"]
        found_anything = False

        if value.startswith('$:'):
            found_anything = True
            shell_only = False
            last_query = value[2:].strip()
        elif value.startswith('$'):
            found_anything = True
            shell_only = True
            last_query = value[1:].strip()
        else:
            last_query = ''

        if found_anything:
            selections = []
            if len(last_query):
                selections = [
                    Selection(0, last_query, "выполнить команду").to_json(),
                    Selection(1, last_query + " &", "выполнить команду асинхронно").to_json()
                ]
            else:
                selections = [
                    Selection(0, 'пустая команда', 'введите команду').to_json()
                ]
            send_event('queried', selections = selections)

    def quit(ev):
        raise Exception()

    def submit(ev):
        nonlocal last_query

        id = ev["id"]
        log(dumps(ev))

        try:
            if id is not None:
                subprocess.Popen(last_query, shell = True)
        except Exception:
            log("[ERROR] command launch error")

        send_event("close")

    handlers = {
        "complete": complete,
        "query": query,
        "quit": quit,
        "submit": submit
    }

    def handle_event(event):
        event_type = event["event"]
        if event_type in handlers:
            handler = handlers[event_type]
            handler(event)

    return handle_event

plugin = create_plugin()

while True:
    event = get_event()
    if event:
        try:
            plugin(event)
        except Exception:
            break
