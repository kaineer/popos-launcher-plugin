#!/usr/bin/gjs

const { GLib, Gio } = imports.gi;

const STDIN = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({ fd: 0 }) })
const STDOUT = new Gio.DataOutputStream({ base_stream: new Gio.UnixOutputStream({ fd: 1 }) })

const send = (object) => {
  try {
    STDOUT.write_bytes(
      new GLib.Bytes(JSON.stringify(object) + "\n"), null
    );
  } catch (e) {
    log(`failed to send response to Pop Shell: ${e}`);
  }
};

const createPlugin = () => {
  //
  let shell_only = false;
  let last_query = '';

  const handlers = {
    complete() {
      send({ event: 'noop' });
    },
    query({ value }) {
      if (value.startsWith('$:')) {
        shell_only = false;
        last_query = value.substr(2).trim();
      } else if (value.startsWith('$')) {
        shell_only = true;
        last_query = value.substr(1).trim();
      }

      let selections;
      if (last_query.length) {
        selections = [{
          id: 0,
          name: last_query,
          description: 'выполнить команду'
        }, {
          id: 1,
          name: last_query + ' &',
          description: 'выполнить команду асинхронно'
        }];
      } else {
        selections = [{
          id: 0,
          name: 'пустая команда',
          description: 'введите команду'
        }];
      }

      send({ event: 'queried', selections });
    },
    quit() {
      throw new Error('Quit');
    },
    submit({ id }) {
      try {
        let runner;
        if (id !== null) {
          if (shell_only) {
            runner = '';
          } else {
            let path = GLib.find_program_in_path('x-terminal-emulator');
            let [terminal, splitter] = path ? [path, "-e"] : ["gnome-terminal", "--"];
            runner = `${terminal} ${splitter} `;
          }

          GLib.spawn_command_line_async(
            `${runner}sh -c '${last_query}; echo "Press to exit"; read t'`
          );
        }
      } catch (e) {
        log(`command launch error: ${e}`);
      }

      send({ event: 'close' });
    }
  };

  const handleEvent = (event) => {
    const handler = handlers[event.event] || (() => null);
    handler(event);
  };

  return handleEvent;
};

const getEvent = () => {
  try {
    /** @type {null | ByteArray} */
    const [input_array,] = STDIN.read_line(null);

    /** @type {string} */
    const input_str = imports.byteArray.toString(input_array);

    return parse_event(input_str);
  } catch (e) {
    return null;
  }
};

/**
 * Parses an IPC event received from STDIN
 * @param {string} input
 * @returns {null | LauncherRequest}
 */
const parse_event = (input) => {
  try {
    return JSON.parse(input);
  } catch (e) {
    log(`Input not valid JSON`);
    return null;
  }
};

(() => {
  const plugin = createPlugin();

  while (true) {
    /** @type {null | LauncherRequest} */
    const event = getEvent();
    if (event !== null) {
      try {
        plugin(event);
      } catch (e) {
        break;
      }
    }
  }
})();
