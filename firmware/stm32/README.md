# DSPLink

**STM32F429ZI-Based Bootloader and Runtime Controller for an ADAU1701 Audio DSP**

DSPLink is an embedded computer architecture project built around a fixed hardware platform:

- **NUCLEO-F429ZI** as the main embedded controller
- **Multifunction Shield** as the local user interface
- **TSA1701 Audio DSP Board** as the real-time audio processing target

The project implements a microcontroller-controlled boot and runtime-management architecture for an ADAU1701-based audio DSP board. The STM32F429ZI is responsible for system initialization, DSP configuration, preset management, user-interface handling, and runtime parameter updates. The TSA1701 performs the real-time audio signal processing.

DSPLink demonstrates how a general-purpose microcontroller can control a dedicated signal-processing device in a heterogeneous embedded system.

---

## Project Goal

The goal of DSPLink is to build a standalone embedded controller for the TSA1701 Audio DSP Board.

Instead of depending on a PC-connected programming adapter during operation, DSPLink uses the STM32F429ZI to control the DSP from firmware. The system powers up, initializes the control interfaces, configures the DSP, and then allows the user to switch audio-processing modes from the Multifunction Shield.

The project focuses on the embedded architecture behind the system:

- DSP boot sequencing
- Register and memory configuration
- I²C/SPI peripheral communication
- Runtime parameter control
- User-interface state management
- Hardware/software partitioning
- Real-time data path versus control path separation

---

## System Architecture

```text
                        ┌──────────────────────────┐
                        │   Multifunction Shield   │
                        │                          │
                        │  Buttons                 │
                        │  LEDs                    │
                        │  7-segment display       │
                        │  Buzzer                  │
                        │  Potentiometer           │
                        └─────────────┬────────────┘
                                      │ GPIO / ADC
                                      ▼
┌────────────────────────────────────────────────────────────────┐
│                         NUCLEO-F429ZI                          │
│                                                                │
│  STM32F429ZI                                                   │
│  - Boot state machine                                          │
│  - DSP communication driver                                    │
│  - Preset manager                                              │
│  - Runtime parameter controller                                │
│  - MFS user-interface driver                                   │
│  - UART debug console                                          │
└───────────────────────────────┬────────────────────────────────┘
                                │ I²C / SPI / GPIO
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                    TSA1701 Audio DSP Board                     │
│                                                                │
│  ADAU1701 SigmaDSP                                             │
│  - Program memory                                              │
│  - Parameter memory                                            │
│  - Control registers                                           │
│  - Real-time audio processing                                  │
│                                                                │
│  Audio Input ─────────► DSP Core ─────────► Audio Output       │
└────────────────────────────────────────────────────────────────┘
```

The architecture is divided into two planes.

### 1. Audio Data Path

The TSA1701 processes audio continuously in real time.

Example processing blocks:

- Audio pass-through
- Master volume
- Equalization
- Low-pass and high-pass filtering
- Bass enhancement
- Voice enhancement
- Compressor/limiter
- Bypass mode

### 2. Control Path

The STM32F429ZI controls the behavior of the DSP.

Control responsibilities:

- Reset and boot sequencing
- DSP register writes
- Program and parameter loading
- Runtime parameter updates
- Preset switching
- Button handling
- LED/display feedback
- Error reporting
- Debug logging

---

## Hardware Platform

### Required Hardware

| Component | Role |
|---|---|
| NUCLEO-F429ZI | Main embedded controller |
| Multifunction Shield | Local user interface |
| TSA1701 Audio DSP Board | Real-time audio DSP target |
| Audio source | PC, phone, signal generator, or line-level source |
| Audio output | Powered speaker, amplifier, or line-level monitor |
| Jumper wires | DSP control connections |
| USB cable | NUCLEO programming, debug, and serial console |

### Fixed Hardware Decision

DSPLink targets the **NUCLEO-F429ZI + Multifunction Shield** combination as the final controller and user-interface platform.

The Multifunction Shield is used as the project front panel:

| MFS Feature | DSPLink Function |
|---|---|
| Buttons | Preset selection and menu control |
| LEDs | Boot status, active mode, error indication |
| 7-segment display | Preset number, parameter value, error code |
| Buzzer | Optional boot/error feedback |
| Potentiometer | Runtime control of volume, gain, or filter parameter |

---

## Development Framework

DSPLink uses:

```ini
framework = stm32cube
```

STM32Cube is selected because DSPLink requires direct control over:

- GPIO
- I²C
- SPI
- UART
- ADC
- timers
- interrupts
- low-level initialization order

The firmware is designed as a bare-metal state machine using STM32 HAL and, where useful, STM32 LL-style peripheral access.

---

## PlatformIO Configuration

The recommended `platformio.ini` is:

```ini
[env:nucleo_f429zi]
platform = ststm32
board = nucleo_f429zi
framework = stm32cube

upload_protocol = stlink
debug_tool = stlink

monitor_speed = 115200
```

Optional serial monitor configuration:

```ini
monitor_port = /dev/ttyACM0
```

The exact serial port depends on the host operating system.

---

## Browser Preset Tuner

The `frontend/` directory contains a static browser UI for tuning the current
DSPLink preset model before committing values to firmware.

Open `frontend/index.html` in a browser. The tuner provides:

- one tab per firmware preset
- a Bode-style frequency response editor with draggable low, mid, and high
  mixer-path handles
- master gain, bypass, and per-band controls
- undo with `Ctrl+Z`
- redo with `Ctrl+Y` or `Ctrl+Shift+Z`
- a payload preview with the effective SigmaDSP 5.23 mixer values used by the
  current `dsplink_params_set_tsa1701_controls` contract

---

## Multifunction Shield Pin Contract

DSPLink assumes a common Arduino-style Multifunction Shield layout mounted on the NUCLEO-F429ZI shield headers.

Typical project mapping:

| MFS Signal | Shield Pin | DSPLink Use |
|---|---:|---|
| Button S1 | A1 | Previous preset / menu back |
| Button S2 | A2 | Next preset / menu forward |
| Button S3 | A3 | Select / apply / bypass |
| Potentiometer | A0 | Runtime parameter input |
| LED1 | D13 | System running |
| LED2 | D12 | DSP configured |
| LED3 | D11 | Preset active |
| LED4 | D10 | Error / safe mode |
| Buzzer | D3 | Optional status beep |
| 74HC595 latch | D4 | 7-segment display control |
| 74HC595 clock | D7 | 7-segment display control |
| 74HC595 data | D8 | 7-segment display control |

The firmware should expose the shield through a dedicated MFS driver so that the rest of the application does not depend directly on GPIO pin names.

---

## TSA1701 Control Interface

The STM32F429ZI communicates with the TSA1701 through a serial control interface.

Primary target interface:

```text
STM32F429ZI ───── I²C or SPI ───── TSA1701 / ADAU1701
```

The low-level bus layer should support:

- Single-byte register writes
- Multi-byte block writes
- Program-memory loading
- Parameter-memory loading
- Control-register configuration
- Bus timeout detection
- Error reporting
- Optional transaction logging

Example abstraction:

```c
typedef enum {
    DSPLINK_OK = 0,
    DSPLINK_ERROR_BUS,
    DSPLINK_ERROR_TIMEOUT,
    DSPLINK_ERROR_INVALID_ARGUMENT,
    DSPLINK_ERROR_DSP_NOT_READY
} dsplink_status_t;

dsplink_status_t dsplink_bus_write_u8(uint16_t address, uint8_t value);

dsplink_status_t dsplink_bus_write_block(
    uint16_t address,
    const uint8_t *data,
    uint16_t length
);
```

Higher-level code should not write directly to the bus. Presets and parameters should be applied through the DSPLink API.

Example:

```c
dsplink_apply_preset(DSPLINK_PRESET_BASS_BOOST);
dsplink_set_master_volume_db(-6.0f);
dsplink_set_bypass(false);
```

---

## Firmware Architecture

Suggested project structure:

```text
DSPLink/
├── platformio.ini
├── README.md
│
├── include/
│   ├── dsplink.h
│   ├── dsplink_boot.h
│   ├── dsplink_bus.h
│   ├── dsplink_params.h
│   ├── dsplink_presets.h
│   ├── dsplink_state.h
│   ├── mfs.h
│   └── uart_debug.h
│
├── src/
│   ├── main.c
│   ├── dsplink_boot.c
│   ├── dsplink_bus.c
│   ├── dsplink_params.c
│   ├── dsplink_presets.c
│   ├── dsplink_state.c
│   ├── mfs.c
│   └── uart_debug.c
│
├── sigmastudio/
│   ├── exported_program.c
│   ├── exported_program.h
│   ├── exported_params.c
│   └── exported_params.h
│
└── docs/
    ├── architecture.md
    ├── pinout.md
    ├── boot_sequence.md
    └── demo_plan.md
```

---

## Main Firmware Modules

### `main.c`

Application entry point.

Responsibilities:

- Initialize STM32 HAL
- Initialize clocks
- Initialize GPIO, UART, I²C/SPI, ADC, and timers
- Start DSPLink state machine
- Run the main control loop

### `dsplink_state`

Global system state machine.

Responsibilities:

- Track boot progress
- Track active preset
- Track error state
- Coordinate UI and DSP actions

### `dsplink_boot`

DSP initialization layer.

Responsibilities:

- Place the DSP in a known startup condition
- Load exported DSP configuration data
- Apply initial parameters
- Enable the default preset
- Report boot status

### `dsplink_bus`

Low-level communication layer.

Responsibilities:

- I²C/SPI writes
- Block transfers
- Retry policy
- Timeout handling
- Optional debug logging

### `dsplink_presets`

Preset-management layer.

Responsibilities:

- Define available audio modes
- Apply groups of parameter writes
- Coordinate display and LED feedback
- Provide a clean preset API

### `dsplink_params`

Runtime parameter layer.

Responsibilities:

- Convert user-level values into DSP parameter values
- Safeload the official TinySine mixer coefficients at runtime
- Apply output-gate bypass changes
- Prevent invalid parameter ranges

Implementation note:

- The official TinySine graph exposes the active three-channel mixer coefficients at parameter RAM addresses `87..92`.
- Runtime control writes use the ADAU1701 safeload registers so running DSP parameters update coherently.
- Wider writes remain limited to normal control registers such as DSP core control.

### `mfs`

Multifunction Shield driver.

Responsibilities:

- Read and debounce buttons
- Read potentiometer value through ADC
- Drive LEDs
- Drive the 7-segment display
- Control buzzer feedback

### `uart_debug`

Debug console layer.

Responsibilities:

- Print boot messages
- Print bus errors
- Print active preset
- Print runtime parameter values
- Support simple diagnostic commands if needed

---

## Boot Sequence

The expected DSPLink boot sequence is:

```text
1. Power is applied.
2. STM32F429ZI starts execution.
3. STM32 initializes clocks and core peripherals.
4. UART debug console starts.
5. Multifunction Shield driver starts.
6. DSP control bus starts.
7. DSP is placed in a known reset or idle state.
8. STM32 sends DSP configuration data.
9. STM32 applies default runtime parameters.
10. STM32 marks the DSP as ready.
11. Audio processing begins.
12. Main control loop handles user input and parameter updates.
```

Example UART output:

```text
[DSPLink] Boot
[DSPLink] Clock initialized
[DSPLink] MFS initialized
[DSPLink] Control bus initialized
[DSPLink] Resetting DSP
[DSPLink] Loading DSP program
[DSPLink] Loading DSP parameters
[DSPLink] Loading DSP registers
[DSPLink] DSP ready
[DSPLink] Active preset: FLAT
```

---

## Runtime Control Flow

Example preset-switching flow:

```text
1. User presses S2 on the Multifunction Shield.
2. MFS driver debounces the button event.
3. DSPLink state machine requests the next preset.
4. Preset manager selects the corresponding TinySine mixer-coefficient profile.
5. Bus driver safeloads updated mixer values to the TSA1701.
6. Display updates to show the new preset number.
7. LEDs update to show the active state.
8. Audio output changes in real time.
```

Example potentiometer flow:

```text
1. User rotates the MFS potentiometer.
2. ADC samples the analog value.
3. Firmware maps ADC value to a SigmaDSP 5.23 mixer-gain coefficient.
4. DSPLink safeloads the updated mixer coefficients to the DSP.
5. Display shows the current parameter value.
```

---

## Audio Presets

The final demonstration can include the following presets:

| Preset ID | Name | Description |
|---:|---|---|
| 0 | FLAT | Neutral audio pass-through |
| 1 | BASS | First crossover mixer path only |
| 2 | VOICE | Second crossover mixer path only |
| 3 | NIGHT | Reduced all-path mixer gain |
| 4 | FILTER | Third crossover mixer path only |
| 5 | BYPASS | Used to compare processed and unprocessed behavior |

Suggested UI behavior:

| Input | Action |
|---|---|
| S1 | Previous preset |
| S2 | Next preset |
| S3 | Toggle bypass or apply selected preset |
| Potentiometer | Adjust selected parameter |

Suggested display behavior:

| Display | Meaning |
|---|---|
| `P0` | Flat preset |
| `P1` | Bass preset |
| `P2` | Voice preset |
| `P3` | Night preset |
| `P4` | Filter preset |
| `BP` | Bypass enabled |
| `Er` | Error state |

---

## State Machine

DSPLink uses a deterministic firmware state machine.

```text
┌────────────┐
│   RESET    │
└─────┬──────┘
      ▼
┌────────────┐
│ INIT_MCU   │
└─────┬──────┘
      ▼
┌────────────┐
│ INIT_UI    │
└─────┬──────┘
      ▼
┌────────────┐
│ INIT_BUS   │
└─────┬──────┘
      ▼
┌────────────┐
│ INIT_DSP   │
└─────┬──────┘
      ▼
┌────────────┐
│ VERIFY_DSP │
└─────┬──────┘
      ▼
┌────────────┐
│    RUN     │
└─────┬──────┘
      ▼
┌────────────┐
│ CONTROL_UI │
└────────────┘
```

Possible error states:

```text
BUS_ERROR
DSP_TIMEOUT
DSP_CONFIG_ERROR
INVALID_PRESET
SAFE_MODE
```

In `SAFE_MODE`, DSPLink should:

- Indicate an error using LED4 and the 7-segment display
- Stop applying new presets
- Keep audio muted or apply a known safe default
- Continue UART logging for diagnosis

---

## SigmaStudio Integration

DSPLink uses SigmaStudio to design and export the DSP signal-processing graph.

Recommended workflow:

```text
1. Create the DSP processing graph in SigmaStudio.
2. Test the graph on the TSA1701.
3. Export the generated system files.
4. Convert exported program, parameter, and register data into C tables.
5. Include the tables in the STM32 firmware.
6. Let the STM32F429ZI configure the DSP at startup.
7. Use MFS controls to update selected parameters at runtime.
```

The STM32 firmware owns the embedded boot and runtime-control process. SigmaStudio remains the DSP algorithm design tool.

---

## Demonstration Plan

### Demo 1: User Interface Bring-Up

Goal: prove that the NUCLEO-F429ZI and Multifunction Shield are working as the front panel.

Demo steps:

- Press each button
- Toggle LEDs
- Show values on the 7-segment display
- Read potentiometer value
- Print UI events over UART

### Demo 2: DSP Communication

Goal: prove that the STM32F429ZI can communicate with the TSA1701.

Demo steps:

- Initialize the control bus
- Load the official TinySine TSA1701 V1r1 SigmaDSP program from STM32 firmware
- Log the transaction over UART
- Report success or error on the display and status LEDs

### Demo 3: Runtime Parameter Update

Goal: prove that the STM32F429ZI can modify DSP behavior while audio is running.

Demo steps:

- Play audio through the TSA1701
- Rotate the MFS potentiometer
- Map the potentiometer to the official TinySine mixer coefficients
- Hear the audio change in real time
- Display the current gain value and log the parameter write over UART

### Demo 4: Preset Switching

Goal: demonstrate the final product behavior.

Demo steps:

- Press MFS buttons to switch presets
- Show the active preset on the 7-segment display
- Safeload preset-specific TinySine mixer-coefficient values
- Show system state on LEDs
- Toggle the DSP output gate using the bypass control
- Print the active preset over UART

### Demo 5: Standalone Boot

Goal: demonstrate the computer architecture focus of the project.

Demo steps:

- Power-cycle the system
- Show STM32 boot messages over UART
- Show MFS boot status
- Configure the DSP from STM32 firmware
- Start audio processing without manual PC-side DSP reconfiguration

---

## Academic Relevance

DSPLink demonstrates core computer architecture concepts in a real embedded system.

| Concept | Implementation in DSPLink |
|---|---|
| Heterogeneous architecture | STM32F429ZI controls the system, TSA1701 performs real-time DSP |
| Boot process | STM32 executes a deterministic DSP initialization sequence |
| Memory organization | DSP program memory, parameter memory, and control registers are configured externally |
| Peripheral buses | I²C/SPI transactions transfer configuration and runtime parameters |
| Hardware/software partitioning | Audio processing is assigned to dedicated DSP hardware |
| Real-time behavior | Audio data path runs continuously while control updates occur asynchronously |
| State machines | Firmware transitions through reset, initialization, DSP configuration, run, and error states |
| User-interface mapping | MFS inputs are translated into low-level parameter writes |
| Fault handling | Bus errors and invalid states trigger visible safe-mode behavior |

---

## Expected Learning Outcomes

By completing DSPLink, the developer should be able to explain and demonstrate:

- How a microcontroller configures an external processing device
- How an audio DSP differs from a general-purpose microcontroller
- How boot sequences are structured in multi-chip embedded systems
- How runtime parameter updates are sent to a DSP
- How I²C/SPI buses are used for embedded control
- How user-interface events become hardware-level register or memory writes
- How to separate the real-time audio data path from the embedded control path
- How to design firmware as a deterministic state machine

---

## Electrical Notes

DSPLink uses the NUCLEO-F429ZI as a 3.3 V embedded controller. The Multifunction Shield is mounted on the NUCLEO-F429ZI shield headers and is used as the local user interface.

Recommended electrical practices:

- Use a common ground between the NUCLEO-F429ZI and TSA1701.
- Confirm the TSA1701 control-interface voltage before connecting I²C/SPI lines.
- Use appropriate pull-up resistors for I²C if the board does not already provide them.
- Keep digital control wiring away from sensitive analog audio wiring where possible.
- Start audio tests at low volume.
- Avoid connecting amplified speaker outputs to line-level audio inputs.
- Avoid driving headphones directly from outputs not designed for that load.

---

## Build and Flash

### 1. Create the PlatformIO Project

Create a PlatformIO project with:

```text
Board: ST Nucleo F429ZI
Framework: STM32Cube
```

### 2. Add the Firmware Source

Place the DSPLink source files into the PlatformIO project structure.

### 3. Build

```bash
pio run
```

### 4. Upload

```bash
pio run --target upload
```

### 5. Open Serial Monitor

```bash
pio device monitor --baud 115200
```

---

## Initial Milestones

```text
[x] Create PlatformIO STM32Cube project for NUCLEO-F429ZI
[x] Verify UART debug output
[x] Bring up Multifunction Shield LEDs
[x] Bring up Multifunction Shield buttons
[x] Bring up 7-segment display
[x] Read MFS potentiometer through ADC
[x] Implement DSP control-bus write function
[x] Send first TSA1701 control transaction
[x] Apply first runtime DSP parameter update
[x] Implement preset switching from MFS buttons
[x] Load DSP configuration from STM32 firmware
[x] Demonstrate standalone boot and runtime control
```

---

## Final Success Criteria

DSPLink is considered successful when:

1. The NUCLEO-F429ZI boots and initializes the system.
2. The Multifunction Shield works as the physical user interface.
3. The STM32F429ZI communicates with the TSA1701.
4. The system can apply at least one DSP parameter update at runtime.
5. The user can switch between at least three audio presets.
6. The active preset is visible on the MFS display or LEDs.
7. UART logs show the boot and control sequence.
8. The final demonstration clearly separates the audio data path from the embedded control path.

---

## Project Status

```text
Working standalone demonstration
```

Current target platform:

```text
Controller: NUCLEO-F429ZI
User interface: Multifunction Shield
DSP target: TSA1701 Audio DSP Board
Framework: STM32Cube
Build system: PlatformIO
```

Validated demonstration path:

```text
Laptop headphone output -> TSA1701 LineIn
TSA1701 LineOut2 -> powered speaker
NUCLEO-F429ZI I2C1 PB8/PB9 -> TSA1701 USBi SCL/SDA
NUCLEO-F429ZI UART -> host serial monitor
```

Runtime controls:

| Control | Behavior |
|---|---|
| S1 | Previous TinySine mixer-coefficient preset |
| S2 | Next TinySine mixer-coefficient preset |
| S3 | Toggle output gate / bypass state |
| MFS potentiometer | Runtime TinySine mixer-gain control |
| LEDs | Running, DSP ready, preset active, error |
| 7-segment display | Preset, bypass, gain, or error status |

---

## Suggested Final Presentation Title

**DSPLink: STM32F429ZI-Based Bootloader and Runtime Controller for an Audio DSP**

Suggested subtitle:

**A heterogeneous embedded architecture using a NUCLEO-F429ZI, Multifunction Shield, and TSA1701 real-time audio DSP board.**

---

## Author

Developed as a final project for a Computer Architecture course.

---

## License

This project may be released under the MIT License unless otherwise specified.
