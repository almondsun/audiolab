# AudioLab Hardware Architecture Specification

## 1. Purpose

This document defines the hardware architecture for AudioLab. It describes the
physical and electrical structure of the codec daughterboard, the interface to
the NUCLEO-F429ZI target board, the TLV320AIC3104 codec subsystem, the analog
input/output paths, the digital control and audio buses, measurement access, and
the intended Altium design organization.

This document is not a completed schematic review. It defines the architecture
that the schematic and PCB design shall implement.

## 2. Hardware Scope

The hardware scope includes:

- an Altium PCB project for the AudioLab daughterboard;
- the TLV320AIC3104 stereo audio codec and its required support circuitry;
- board-to-board connections to the NUCLEO-F429ZI headers;
- codec power, reset, I2C control, and SAI/I2S digital-audio interfaces;
- line or microphone input paths for codec ADC evaluation;
- headphone or line output paths for codec DAC evaluation;
- test points and current-measurement features for bring-up;
- schematic and PCB library files used by the design.

The hardware scope does not include the internal design of the NUCLEO-F429ZI
board, PC host hardware, headphones, microphones, lab instruments, or external
USB hubs.

## 3. Source Organization

The Altium hardware source is organized under `hardware/altium/`:

```text
hardware/altium/
  project/
    audiolab-dev.PrjPcb
    audiolab.SchDoc
    codec.SchDoc
    usr_interface.SchDoc
    AudioLab.PcbDoc
  library/
    *.SchLib
    *.PcbLib
```

The current project file lists:

- `audiolab.SchDoc`: top-level system schematic;
- `codec.SchDoc`: codec subsystem schematic;
- `usr_interface.SchDoc`: user and board-interface schematic;
- `AudioLab.PcbDoc`: PCB layout document.

The library folder shall contain project-owned schematic symbols and PCB
footprints. Vendor-generated symbols or footprints may be used only after review
for pin mapping, package dimensions, courtyard, pad geometry, and 3D/body
alignment.

## 4. System Hardware Boundary

The hardware boundary is:

```text
NUCLEO-F429ZI headers
  | 3.3 V digital I/O, SAI/I2S, I2C, reset/status, ground, optional 5 V
  v
AudioLab daughterboard
  | TLV320AIC3104 codec, analog front end, power conditioning, measurement
  v
analog connectors and lab equipment
```

The NUCLEO-F429ZI supplies the STM32F429ZI controller and target USB interface.
The AudioLab daughterboard supplies the codec-centered mixed-signal hardware.

The daughterboard shall not depend on undocumented Nucleo behavior. All required
Nucleo pins, jumpers, and power-source assumptions must be stated in the
schematic notes or hardware release checklist.

## 5. Major Hardware Blocks

### 5.1 Nucleo Interface Block

The Nucleo interface block connects the daughterboard to the STM32F429ZI target.
It shall carry:

- SAI/I2S digital audio signals;
- I2C codec-control signals;
- codec reset or control GPIO;
- optional status or interrupt GPIO;
- `+3V3` reference if used for codec I/O;
- optional `+5V` input if explicitly allowed by the power architecture;
- multiple ground pins for return-current control.

The connector assignment shall keep fast digital audio signals short and
inspectable. It shall place ground pins near clock and data groups where
available.

### 5.2 Codec Block

The codec block centers on the TLV320AIC3104 stereo audio codec. It shall include:

- codec power pins and local decoupling;
- hardware reset connection;
- I2C control pins;
- SAI/I2S-compatible audio pins;
- clock input path;
- analog input pins and bias network;
- analog output pins and output network;
- exposed-pad and ground connections;
- test access to critical signals where practical.

The codec schematic shall make supply-domain ownership explicit:

- `AVDD` and `DRVDD` connect to `+3V3_A`;
- `DVDD` connects to `+1V8_D`;
- `IOVDD` connects to `+3V3_IO`;
- analog and digital returns follow the grounding architecture.

### 5.3 Power Block

The power block shall implement the power distribution architecture in
`docs/specs/power/architecture.md`.

The hardware design shall include:

- protected `+5V_SYS` input when the daughterboard is externally powered;
- local regulation or filtering for `+3V3_A`, `+1V8_D`, and `+3V3_IO` as selected;
- rail test points;
- current-measurement access;
- reset or power-good behavior sufficient to keep the codec safe during startup;
- back-feed prevention where multiple power sources can be connected.

No schematic release is allowed until the source of `+3V3_IO` is selected:

- Nucleo-sourced `+3V3`, which tracks STM32 I/O directly; or
- locally generated `+3V3_IO`, with explicit protection against powering an
  unpowered STM32 through digital signals.

### 5.4 Analog Input Block

The analog input block shall provide at least one practical input path for codec
ADC evaluation.

The first hardware revision should support:

- line-level input evaluation;
- microphone input evaluation or a clear provision for it;
- AC coupling or biasing consistent with the selected codec input mode;
- input impedance appropriate for the intended source;
- optional anti-aliasing or RF filtering where justified;
- ESD or abuse protection for user-accessible connectors;
- access points for signal injection and measurement.

The schematic shall state whether each input is:

- single-ended or differential;
- biased by codec common-mode behavior, external bias, or microphone bias;
- intended for line input, electret microphone, or lab signal generator input;
- AC-coupled or DC-coupled.

### 5.5 Analog Output Block

The analog output block shall provide at least one practical output path for
codec DAC evaluation.

The first hardware revision should support:

- headphone output evaluation or line-output evaluation;
- output coupling appropriate for the selected codec output configuration;
- load assumptions for headphones, line inputs, or lab instruments;
- mute-safe startup behavior;
- access points for oscilloscope and audio analyzer measurement.

The schematic shall state whether each output is:

- single-ended or differential;
- headphone-capable or line-level only;
- AC-coupled or DC-coupled;
- intended for user listening, lab measurement, or both.

### 5.6 Measurement and Debug Block

Measurement access is a first-class hardware requirement. The board shall expose:

- power rail test points;
- ground reference test points;
- codec reset;
- I2C `SCL` and `SDA`;
- SAI/I2S clocks and data;
- at least one analog input measurement point;
- at least one analog output measurement point.

Current measurement shall be provided for the major codec supply domains where
practical:

- `+3V3_A`;
- `+1V8_D`;
- `+3V3_IO`;
- total daughterboard input current.

Measurement features shall not degrade normal operation or create fragile audio
return paths.

## 6. Digital Interfaces

### 6.1 SAI/I2S Audio Interface

The STM32 shall be the preferred audio clock master. The codec shall operate as
the audio bus slave for the initial design.

The baseline digital-audio interface is:

| Function | Direction | STM32/Nucleo signal | Codec signal |
| --- | --- | --- | --- |
| Master clock | STM32 to codec | `SAI_A_MCLK` / `PE2` | `MCLK` |
| Bit clock | STM32 to codec | `SAI_A_SCK` / `PE5` | `BCLK` |
| Word clock | STM32 to codec | `SAI_A_FS` / `PE4` | `WCLK` |
| Playback data | STM32 to codec | `SAI_A_SD` / `PE6` | `DIN` |
| Capture data | codec to STM32 | `SAI_B_SD` / `PE3` | `DOUT` |

`DIN` and `DOUT` are named from the codec perspective. Playback data from the
STM32 connects to codec `DIN`; capture data from codec `DOUT` connects to the
STM32 receive signal.

The baseline audio mode is:

- 48 kHz sample rate;
- stereo frame;
- at least 16-bit PCM samples;
- 32-bit slots preferred for alignment and future 24-bit codec operation;
- STM32-generated clocking.

The exact SAI/I2S protocol format shall be selected in the firmware architecture
and matched in the codec register configuration.

### 6.2 I2C Control Interface

The codec control interface shall be I2C.

The baseline control mapping is:

| Function | STM32/Nucleo signal | Codec signal |
| --- | --- | --- |
| I2C clock | `I2C1_SCL` / `PB8` | `SCL` |
| I2C data | `I2C1_SDA` / `PB9` | `SDA` |

I2C pull-ups shall connect to the selected `+3V3_IO` rail. If pull-ups already
exist on the Nucleo path, the final schematic shall verify the effective pull-up
resistance and bus rise time instead of blindly adding duplicate pull-ups.

### 6.3 Reset and Status Interface

The codec shall have an STM32-controlled reset or equivalent safe initialization
path. The reset net shall default to the safe state during STM32 reset and
during daughterboard power instability.

Optional status signals may include:

- codec interrupt or GPIO output if used;
- hardware mute control;
- power-good inputs to STM32;
- rail-fault indicator.

Optional signals shall not be added unless they simplify bring-up, validation, or
fault handling.

### 6.4 USB Boundary

The target USB audio/control connection is on the NUCLEO-F429ZI target USB
interface. The daughterboard shall not route USB data unless a later hardware
revision explicitly implements an integrated USB connector or one-cable design.

During development, the daughterboard shall assume:

- Nucleo `CN1` is used for ST-LINK power/debug;
- Nucleo `CN13` is used for STM32 target USB audio/control data;
- `CN13` is not a daughterboard power source.

## 7. Analog Architecture

### 7.1 Input Routing

At least one input path shall be wired to codec inputs suitable for the selected
demonstration mode. The preferred first-revision architecture is:

```text
line/microphone connector
  |
  +-- ESD or input protection where required
  +-- coupling and bias network
  +-- optional RC filtering
  +-- codec input pins
```

The design should support a clean lab loopback path from output to input, either
directly through connectors or through a controlled test harness.

### 7.2 Output Routing

At least one output path shall be wired from codec outputs suitable for the
selected demonstration mode. The preferred first-revision architecture is:

```text
codec output pins
  |
  +-- output coupling or common-mode network
  +-- optional protection or damping
  +-- headphone, line, or measurement connector
```

Output routing shall avoid user-accessible pops or unstable states at startup
where practical.

### 7.3 Mixed-Signal Partitioning

The PCB shall treat analog inputs, analog outputs, clock/data signals, and power
conversion as separate layout concerns.

The layout shall:

- place codec decoupling close to codec supply pins;
- keep analog input traces away from digital clocks;
- keep high-edge-rate clocks away from high-impedance analog nodes;
- avoid routing digital return currents through analog input return paths;
- keep codec clock paths short and inspectable;
- provide enough clearance around audio connectors for lab use.

## 8. Connector Architecture

The final connector set shall include:

- Nucleo board-to-board connection for SAI/I2S, I2C, reset, ground, and power
  references;
- analog input connector or header;
- analog output connector or header;
- power input connector if the daughterboard is externally powered;
- test/debug header or test-point group.

Connector choices shall be driven by:

- mechanical compatibility with the NUCLEO-F429ZI headers;
- lab usability;
- current rating;
- signal integrity for clocks;
- clear polarity and orientation;
- low risk of accidentally applying power to the wrong rail.

## 9. Library and Footprint Requirements

Every project-owned Altium component shall have:

- reviewed schematic symbol pin names and pin numbers;
- reviewed PCB footprint pad numbering;
- package dimensions checked against the manufacturer package drawing;
- clear component parameters for manufacturer part number and value;
- 3D body or mechanical outline where useful for connector and codec clearance;
- no hidden pins that obscure power or ground ownership.

The TLV320AIC3104 VQFN footprint requires special review for:

- exposed pad geometry and solder-mask strategy;
- thermal/ground pad connection;
- paste aperture strategy;
- pin-1 marking;
- assembly inspection feasibility.

## 10. Hardware Validation Requirements

Before PCB release:

1. verify schematic connectivity for every codec supply pin;
2. verify codec digital I/O rail compatibility with STM32 I/O;
3. verify all SAI/I2S signal directions;
4. verify I2C pull-up ownership and target voltage;
5. verify reset default state;
6. verify no forbidden power back-feed path exists;
7. verify analog input and output coupling against the selected codec modes;
8. verify test points and current-measurement access;
9. verify connector orientation and pin numbering;
10. run Altium electrical-rule checks and review every remaining warning.

During board bring-up:

1. inspect for shorts and assembly defects;
2. power with current limiting;
3. measure all rails before inserting or enabling active interfaces;
4. verify reset timing;
5. verify I2C communication;
6. verify audio clocks;
7. verify codec playback output;
8. verify codec capture input;
9. verify loopback behavior;
10. record rail currents in idle and active modes.

## 11. Design Decisions

The current architecture intentionally chooses:

- a codec daughterboard instead of replacing the NUCLEO-F429ZI;
- SAI/I2S for audio samples rather than analog-only STM32 ADC/DAC paths;
- I2C for codec configuration;
- local codec rails instead of powering codec analog domains directly from a
  noisy general-purpose 3.3 V rail;
- exposed test and measurement access instead of a tightly minimized board;
- project-owned Altium libraries for reviewed symbols and footprints.

These choices optimize for correctness, bring-up visibility, and academic
defensibility rather than minimum board area.

## 12. Open Decisions

The following hardware decisions remain open:

- final Nucleo connector pinout and mechanical stack-up;
- exact codec package footprint implementation;
- exact input connector type and line/microphone routing options;
- exact output connector type and headphone/line-output routing options;
- `+3V3_IO` ownership;
- external power connector and protection topology;
- current-measurement method;
- analog/digital ground tie implementation;
- whether hardware mute is required in addition to codec mute;
- whether an integrated one-cable USB/power design is in scope for the first
  board revision.

## 13. References

- Texas Instruments, TLV320AIC3104 product page and datasheet, covering codec
  control interface, audio serial formats, analog I/O capability, supply
  domains, and package information: https://www.ti.com/product/TLV320AIC3104
- STMicroelectronics, STM32F429ZI product page and datasheet, covering STM32F429ZI
  USB, I2C, SAI/I2S, DMA, DSP, memory, and I/O capabilities:
  https://www.st.com/en/microcontrollers/stm32f429zi.html
- STMicroelectronics, UM1974 STM32 Nucleo-144 boards user manual, covering
  NUCLEO-F429ZI connector assignments, power inputs, and USB OTG FS/device
  behavior:
  https://www.st.com/resource/en/user_manual/um1974-stm32h743-nucleo144-board-stmicroelectronics.pdf
