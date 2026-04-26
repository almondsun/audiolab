# AudioLab

AudioLab is a NUCLEO-F429ZI-based USB audio and embedded DSP platform built
around the TLV320AIC3104 stereo audio codec.

The project is organized as a mixed hardware, firmware, and host-software
repository. The hardware defines the codec daughterboard and supporting
electrical design, the firmware runs on the STM32F429ZI target, and the
host-side software supports configuration, control, measurement, and validation.

## Repository Structure

```text
.
├── assets/
├── docs/
│   └── specs/
│       ├── firmware/
│       ├── hardware/
│       ├── power/
│       ├── software/
│       └── system/
├── firmware/
│   └── stm32/
├── hardware/
│   └── altium/
│       ├── library/
│       └── project/
├── software/
│   └── host/
├── tests/
└── tools/
```

## Directory Roles

`hardware/` contains electronic design source files. The current Altium layout is:

- `hardware/altium/project/`: Altium project files, schematic documents, and PCB documents.
- `hardware/altium/library/`: Altium schematic and PCB library files.

`firmware/` contains embedded code for the target board.

- `firmware/stm32/`: STM32F429ZI firmware, including USB Audio device behavior, SAI/I2S audio transport, I2C codec control, DMA buffering, and real-time DSP blocks.

`software/` contains host-side code that runs on a PC.

- `software/host/`: utilities or applications for device discovery, configuration, codec/DSP control, measurement workflows, and validation support.

`docs/` contains project documentation and specification deliverables.

- `docs/specs/system/`: system requirements specification.
- `docs/specs/power/`: power distribution architecture.
- `docs/specs/hardware/`: hardware architecture specification.
- `docs/specs/firmware/`: firmware architecture specification.
- `docs/specs/software/`: host software architecture specification.

`tests/` contains future validation and regression checks. It should be used for
firmware tests, host-software tests, hardware bring-up checks, audio loopback
tests, and measurement verification scripts when those artifacts exist.

`tools/` contains developer and lab utilities that support the project but are
not part of the firmware, host software, or hardware source. Examples include
export helpers, register-table generators, descriptor inspection scripts, and
measurement-processing tools.

`assets/` contains non-source project media such as reference images, figures,
and exported visual material used by documentation or reports.

## Development Intent

The repository should keep implementation artifacts separated by engineering
boundary:

- Hardware design files stay under `hardware/`.
- STM32 target firmware stays under `firmware/`.
- PC-side support software stays under `software/`.
- Specifications and reports stay under `docs/`.
- Verification artifacts stay under `tests/`.
- Helper automation stays under `tools/`.

Avoid adding a top-level `src/` directory that repeats these boundaries. If a
subproject later needs source/include separation, add that structure inside the
subproject itself, for example `firmware/stm32/src/` or `software/host/src/`.
