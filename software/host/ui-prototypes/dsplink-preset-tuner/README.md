# DSPLink Preset Tuner

This is a static browser companion UI for tuning the runtime preset model used by
the firmware.

Open `index.html` in a browser. No package install or build step is required.

The tuner mirrors the current firmware contract:

- five presets: `FLAT`, `BASS`, `VOICE`, `NIGHT`, and `FILTER`
- one master gain percent passed to `dsplink_params_set_tsa1701_controls`
- three mixer-path gain percentages converted to effective SigmaDSP 5.23 values
- bypass as an output-gate state

The graph is an interactive frequency-response editor. Drag the low, mid, or
high path handles to tune each mixer path. The payload panel shows the effective
values that correspond to the current preset.

Keyboard history:

- `Ctrl+Z`: undo
- `Ctrl+Y`: redo
- `Ctrl+Shift+Z`: redo
