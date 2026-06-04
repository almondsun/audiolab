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
│   ├── context/
│   ├── reference/
│   └── specs/
│       ├── firmware/
│       ├── hardware/
│       ├── power/
│       ├── software/
│       └── system/
├── firmware/
│   └── stm32/
├── hardware/
│   ├── altium/
│   │   ├── library/
│   │   └── project/
│   └── docs/
├── software/
│   └── host/
├── tests/
└── tools/
```

## Directory Roles

`hardware/` contains electronic design source files and exported hardware
deliverables. The current Altium layout is:

- `hardware/altium/project/`: Altium project files, schematic documents, and PCB documents.
- `hardware/altium/library/`: Altium schematic and PCB library files.
- `hardware/altium/pcb3d.step`: exported PCB 3D model.
- `hardware/docs/`: exported schematic and PCB PDFs for review without Altium.

The current implemented hardware project is centered on
`hardware/altium/project/AudioLab.PrjPcb`, with the top-level schematic
`audiolab.SchDoc`, codec schematic `codec.SchDoc`, power schematic
`PowerSupply.SchDoc`, PCB document `AudioLab.PcbDoc`, and generated PCB outputs
under `Project Outputs for AudioLab/`.

`firmware/` contains embedded code for the target board.

- `firmware/stm32/`: STM32F429ZI firmware, including USB Audio device behavior, SAI/I2S audio transport, I2C codec control, DMA buffering, and real-time DSP blocks.
- `firmware/stm32/` currently contains the DSPLink proof-of-concept PlatformIO
  firmware project. DSPLink is the firmware proof-of-concept name and still
  needs target-contract cleanup before it can be considered the final AudioLab
  TLV320AIC3104 firmware.

`software/` contains host-side code that runs on a PC.

- `software/host/`: utilities or applications for device discovery, configuration, codec/DSP control, measurement workflows, and validation support.
- `software/host/ui-prototypes/dsplink-preset-tuner/`: static DSPLink preset
  tuner prototype. It is a UI concept, not the stable AudioLab host-control
  implementation.

`docs/` contains project documentation and specification deliverables.

- `docs/context/`: source context and research notes used to shape the design.
- `docs/reference/`: reference material for proof-of-concept or implementation
  work.
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

## Current Hardware Status

The committed hardware implementation is the most complete part of the
repository. It includes Altium source, project-owned libraries, generated board
outputs, exported schematics, an exported PCB drawing, a 3D STEP model, and board
render images.

The implemented hardware boundary is:

```text
PC USB and NUCLEO-F429ZI
  | USB D+/D-, I2C, SAI/I2S, reset, 5 V, ground
  v
AudioLab TLV320AIC3104 codec daughterboard
  | codec power, analog I/O, measurement and bring-up access
  v
audio sources, headphones, line outputs, and lab instruments
```

Firmware and host software now include the allocated DSPLink proof-of-concept
artifacts. DSPLink targets a NUCLEO-F429ZI-controlled ADAU1701/TSA1701 DSP board
and a Multifunction Shield, so it is not yet the final TLV320AIC3104 AudioLab
firmware contract. The allocation and required target cleanup are documented in
`docs/specs/system/dsplink-allocation.md`.

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
