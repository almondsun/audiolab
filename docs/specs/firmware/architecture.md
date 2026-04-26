# AudioLab Firmware Architecture Specification

## 1. Purpose

This document defines the firmware architecture for AudioLab. It describes the
STM32F429ZI firmware responsibilities, module boundaries, peripheral ownership,
audio data flow, codec control, USB behavior, DSP processing, fault handling,
buffer ownership, timing model, and validation strategy.

This document is an architecture specification. It does not define every source
file, register value, USB descriptor byte, or codec register setting. Those
details belong in implementation files and focused design notes once the
firmware project is created.

## 2. Firmware Scope

The firmware runs on the STM32F429ZI target on the NUCLEO-F429ZI board.

The firmware scope includes:

- startup and board initialization;
- STM32 clock and peripheral configuration;
- USB Audio device behavior;
- optional USB host-control interface;
- TLV320AIC3104 reset and I2C register control;
- SAI/I2S audio transport to and from the codec;
- DMA and interrupt handling for continuous audio streaming;
- playback, capture, and full-duplex audio buffering;
- at least one real-time DSP processing path;
- runtime status, diagnostics, and fault reporting.

The firmware scope does not include PC host application design, PCB layout,
analog audio circuit design, or laboratory measurement scripts.

## 3. Firmware Goals

The firmware shall:

- provide a repeatable path from reset to a known safe audio state;
- configure the codec through a driver rather than scattered register writes;
- stream audio through USB and SAI/I2S without sustained underruns or overruns;
- keep interrupt and DMA ownership explicit;
- keep the real-time audio path bounded and deterministic;
- expose useful diagnostics for bring-up and measurement;
- reject invalid host-control commands without corrupting runtime state;
- keep hardware-specific code out of portable DSP and protocol logic where
  practical.

## 4. Baseline Operating Mode

The baseline firmware mode is:

| Property | Baseline |
| --- | --- |
| Sample rate | 48 kHz |
| Channels | stereo |
| PCM sample width | 16-bit minimum |
| Audio slot width | 32-bit preferred |
| Codec role | SAI/I2S slave |
| STM32 role | SAI/I2S clock master |
| USB role | USB device |
| Codec control | I2C |
| Audio transport | DMA-backed SAI/I2S |
| Scheduler | bare-metal main loop with interrupt/DMA callbacks |

An RTOS is not required for the first implementation. It may be introduced only
if it clarifies timing, ownership, or feature isolation enough to justify the
extra integration surface.

## 5. Firmware Layering

The firmware shall use the following architectural layers:

```text
application
  system state machine, mode control, fault policy

services
  audio pipeline, control service, diagnostics, DSP service

drivers
  TLV320AIC3104 codec driver, USB device adapter, SAI/I2S adapter,
  I2C adapter, GPIO/reset adapter, timer adapter

platform
  startup, clock tree, DMA, interrupt priorities, board pin configuration

vendor
  STM32 HAL/LL, CMSIS, USB device stack, optional ST USB audio middleware
```

Application code may call services. Services may call drivers. Drivers may call
platform and vendor APIs. Vendor and platform code shall not call back into
application code except through explicitly registered callbacks or event queues.

## 6. Module Responsibilities

### 6.1 Platform Module

The platform module owns STM32-specific setup:

- system clock configuration;
- audio clock source configuration;
- GPIO alternate-function configuration;
- DMA stream/channel configuration;
- interrupt priority configuration;
- SysTick or timer tick setup;
- low-level error trap behavior.

The platform module shall expose a small board-level API to the rest of the
firmware. It shall not contain codec register sequences, USB class policy, or
DSP algorithms.

### 6.2 Codec Driver

The codec driver owns all TLV320AIC3104 register access and codec state
transitions.

It shall provide operations such as:

```c
aic3104_reset();
aic3104_init_48k_slave();
aic3104_set_input_mode(...);
aic3104_set_output_mode(...);
aic3104_set_adc_gain(...);
aic3104_set_dac_gain(...);
aic3104_mute_outputs(...);
aic3104_read_reg(...);
aic3104_write_reg(...);
```

The driver shall:

- use I2C as the only codec-control transport;
- keep register-page selection internal to the driver;
- report every I2C failure to its caller;
- avoid hidden retries unless the retry policy is documented;
- keep output paths muted until initialization succeeds;
- provide named presets for validated routing modes;
- avoid exposing raw register writes as the normal application interface.

Raw register access may exist for diagnostics, but host-triggered raw writes
shall be guarded so they cannot silently place the device in an unsafe output
state.

### 6.3 Audio Transport Driver

The audio transport driver owns SAI/I2S and DMA movement between STM32 memory
and the codec.

It shall:

- configure the STM32 as the audio clock master;
- drive `MCLK`, `BCLK`, and `WCLK`;
- transmit playback samples to codec `DIN`;
- receive capture samples from codec `DOUT`;
- use DMA for sustained streaming;
- expose half-transfer and transfer-complete events;
- detect DMA, underrun, overrun, and peripheral errors;
- avoid expensive work inside interrupt context.

Interrupt handlers shall acknowledge hardware events quickly and pass work to
the audio pipeline through flags, counters, or lock-free event records.

### 6.4 USB Audio Module

The USB audio module owns USB device enumeration and audio streaming endpoints.

The preferred baseline is USB Audio Class 1.0 behavior, using STM32Cube USB
device infrastructure and adapting ST USB audio examples or middleware where
practical.

The module shall:

- expose playback from host to device;
- expose capture from device to host when enabled;
- provide mute and volume support when implemented;
- keep endpoint packet handling separate from DSP algorithms;
- report enumeration, configuration, endpoint, and streaming state;
- support fixed 48 kHz mode first.

The firmware may later support additional sample rates only after clocking,
codec configuration, USB descriptors, host behavior, and buffer policy are
validated together.

### 6.5 Host Control Module

The host control module owns non-audio control messages from the PC host.

The baseline control channel may be HID, CDC, vendor-specific USB, or a class
control extension selected in the software architecture. Firmware shall treat
the selected control protocol as a stable boundary.

The control module shall:

- parse host commands;
- validate message length, command ID, parameter ranges, and current state;
- dispatch valid commands to application services;
- return explicit success or error status;
- never perform codec or DSP changes directly from the USB interrupt path;
- avoid logging or exposing irrelevant host system information.

Control commands should cover:

- device status;
- firmware version/build identification;
- codec mode selection;
- mute and gain control;
- DSP mode and parameter updates;
- diagnostics counters;
- fault clear or controlled reinitialization.

### 6.6 Audio Pipeline Service

The audio pipeline service owns sample movement between USB buffers, DSP blocks,
and SAI/I2S DMA buffers.

It shall support these flows:

```text
Playback:
  USB OUT -> playback ring buffer -> DSP -> SAI TX DMA -> codec DAC

Capture:
  codec ADC -> SAI RX DMA -> DSP -> capture ring buffer -> USB IN

Full duplex:
  playback and capture flows active with shared timing and fault policy
```

The pipeline shall:

- define sample format at each boundary;
- define interleaving and channel order;
- track buffer fill levels;
- detect and count underruns and overruns;
- provide a bypass path for transport validation;
- keep per-block processing bounded;
- avoid dynamic allocation in the real-time path.

### 6.7 DSP Service

The DSP service owns real-time signal processing.

The first implementation shall include at least one demonstrable DSP block, such
as:

- gain and mute;
- stereo balance;
- biquad equalizer;
- FIR filter;
- simple compressor or limiter;
- level meter.

DSP code shall:

- operate on explicitly documented sample formats;
- avoid heap allocation in the audio callback path;
- keep coefficient/state ownership explicit;
- support a bypass mode;
- validate parameter ranges before applying updates;
- apply parameter updates at block boundaries to avoid partial state changes.

CMSIS-DSP may be used where it reduces risk or improves performance, but the DSP
service shall keep the project-specific interface independent of a single library
where practical.

### 6.8 Diagnostics Service

The diagnostics service owns runtime observability.

It shall track:

- boot count or boot stage when available;
- USB state;
- codec initialization state;
- audio stream state;
- DMA event counters;
- underrun and overrun counters;
- I2C error counters;
- active sample rate and format;
- active codec mode;
- active DSP mode;
- last fault code.

Diagnostics shall be available through the host-control path and may also be
exposed through debug UART, SWO, LEDs, or breakpoints during development.

## 7. State Machine

The application shall use an explicit system state machine:

```text
RESET
  -> BOOT
  -> POWER_WAIT
  -> CODEC_RESET
  -> CODEC_INIT
  -> USB_INIT
  -> IDLE
  -> STREAMING
  -> FAULT
```

State meanings:

- `RESET`: hardware reset or firmware reset entry.
- `BOOT`: clocks, memory, GPIO, and diagnostics are initialized.
- `POWER_WAIT`: firmware waits for safe rail stabilization policy.
- `CODEC_RESET`: codec reset is asserted and released under firmware control.
- `CODEC_INIT`: codec register sequence is applied and verified where practical.
- `USB_INIT`: USB device stack is initialized.
- `IDLE`: device is configured but audio streaming is inactive.
- `STREAMING`: audio endpoints and SAI/I2S transport are active.
- `FAULT`: firmware has detected a blocking error and has forced a safe state.

The state machine shall define which commands are legal in each state. Illegal
commands shall return explicit errors.

## 8. Buffer and Memory Ownership

The firmware shall use static or compile-time allocated buffers for real-time
audio paths.

Required buffer classes:

- USB playback packet buffers;
- USB capture packet buffers;
- playback ring buffer;
- capture ring buffer;
- SAI TX DMA buffer;
- SAI RX DMA buffer;
- DSP scratch/state buffers;
- diagnostics/event records.

Ownership rules:

- DMA owns active DMA buffer regions until the corresponding transfer event;
- interrupt handlers may update counters and publish events, but shall not run
  long DSP operations;
- the audio pipeline owns conversion between USB packet buffers, ring buffers,
  DSP blocks, and DMA buffers;
- host-control commands may update configuration only through validated service
  APIs;
- no real-time audio buffer shall be freed or resized during streaming.

The initial implementation shall avoid heap allocation after startup. If heap
allocation is later introduced, all allocation failure paths must be explicit and
testable.

## 9. Audio Synchronization Strategy

The firmware has two relevant timing domains:

```text
USB host packet timing
  packets nominally arrive or depart on USB frame timing

Codec audio timing
  SAI/I2S clocks consume and produce samples at the configured audio rate
```

The first implementation shall target fixed 48 kHz operation and use buffer fill
monitoring to detect timing mismatch.

The preferred long-term strategy is:

1. fixed 48 kHz playback-only validation;
2. fixed 48 kHz capture-only validation;
3. fixed 48 kHz full-duplex validation;
4. feedback or adaptive synchronization for robust long-running streaming.

For playback, USB Audio feedback should be considered once baseline streaming is
stable. For capture, implicit feedback or packet-length adaptation may be
considered if host behavior and USB stack support it.

Any sample slip, duplicate, or drop strategy shall be explicit, counted, and
reported through diagnostics.

## 10. Error Model

Firmware functions that can fail shall return a status code or publish a typed
fault event. Errors shall not be silently swallowed.

The firmware shall distinguish:

- recoverable transient faults;
- recoverable reinitialization faults;
- blocking faults requiring streaming stop;
- development assertions indicating a programming error.

Required fault classes:

- codec reset failure;
- codec I2C transaction failure;
- codec initialization failure;
- USB enumeration or configuration failure;
- USB endpoint transfer failure;
- SAI/I2S peripheral error;
- DMA transfer error;
- playback underrun;
- capture overrun;
- invalid host command;
- unsupported runtime mode request.

On blocking faults, firmware shall mute or disable audio output before attempting
recovery where practical.

## 11. Concurrency and Interrupt Rules

The firmware shall keep concurrency simple and visible.

Interrupt context may:

- acknowledge peripheral events;
- update atomic or interrupt-safe counters;
- swap DMA buffer ownership markers;
- enqueue compact events;
- wake the main loop.

Interrupt context shall not:

- perform I2C codec reconfiguration;
- parse complex host commands;
- allocate memory;
- run expensive DSP blocks;
- block on locks, waits, or peripheral polling;
- print long diagnostics.

The main loop shall own slow operations such as codec reconfiguration, fault
recovery, host-control dispatch, and diagnostics reporting.

## 12. Firmware Source Layout

The future firmware project should live under `firmware/stm32/`.

Recommended source layout:

```text
firmware/stm32/
  app/
  bsp/
  drivers/
    codec/
    audio/
    usb/
  dsp/
  platform/
  tests/
  thirdparty/
```

Directory roles:

- `app/`: system state machine and top-level mode orchestration.
- `bsp/`: board pin mapping and NUCLEO/AudioLab board constants.
- `drivers/codec/`: TLV320AIC3104 driver.
- `drivers/audio/`: SAI/I2S and DMA transport adapter.
- `drivers/usb/`: USB audio and optional control-channel adapter.
- `dsp/`: project DSP blocks and parameter handling.
- `platform/`: startup, clock, interrupt, and STM32 peripheral setup.
- `tests/`: firmware-local tests when a firmware test harness exists.
- `thirdparty/`: vendored or generated STM32/CMSIS code when required.

Generated STM32Cube or vendor files shall be kept identifiable and should not be
hand-edited unless the generation path is documented.

## 13. Build and Configuration Expectations

The firmware project shall eventually define:

- target MCU and board selection;
- compiler and language standard;
- optimization level for debug and release builds;
- warning policy;
- linker script and memory map;
- USB descriptor configuration;
- audio sample rate and format configuration;
- codec routing presets;
- optional feature flags for playback, capture, full-duplex, host control, and
  DSP modes.

Configuration values that affect hardware contracts shall be visible in source
or generated configuration files, not hidden in IDE-only state.

## 14. Validation Plan

Firmware validation shall proceed in layers:

1. build firmware with warnings reviewed;
2. boot to a visible diagnostic state;
3. verify clock and GPIO configuration;
4. assert and release codec reset;
5. validate I2C read/write with the codec;
6. apply codec initialization sequence;
7. generate SAI/I2S clocks without streaming;
8. validate SAI/I2S DMA callbacks;
9. validate playback with a generated test tone or host audio stream;
10. validate capture with loopback or known input signal;
11. validate DSP bypass and one active DSP mode;
12. validate USB status and host-control error handling;
13. run long enough to detect buffer drift, underruns, and overruns.

The firmware shall not claim full-duplex support until simultaneous playback and
capture run without sustained buffer faults for a defined test interval.

## 15. Open Decisions

The following firmware decisions remain open:

- exact STM32Cube, HAL, LL, or bare-register boundary;
- exact USB audio implementation source and descriptor structure;
- exact host-control transport;
- exact codec register initialization sequence;
- final SAI/I2S protocol format and slot width;
- exact DMA stream/channel assignments;
- interrupt priority plan;
- audio buffer sizes and latency target;
- synchronization strategy for long-running USB audio;
- initial DSP algorithm;
- diagnostics transport during early bring-up;
- firmware build system and test harness.

## 16. References

- STMicroelectronics, STM32F429ZI product page and datasheet, covering USB,
  I2C, SAI/I2S, DMA, memory, DSP, and FPU capabilities:
  https://www.st.com/en/microcontrollers/stm32f429zi.html
- STMicroelectronics, X-CUBE-USB-AUDIO product page, covering STM32 USB Audio
  Class 1.0 playback, recording, feedback, sample-rate, mute, and volume
  support:
  https://www.st.com/en/embedded-software/x-cube-usb-audio.html
- STMicroelectronics, UM2195 USB device audio streaming Expansion Package for
  STM32Cube, covering USB audio streaming architecture:
  https://www.st.com/resource/en/user_manual/um2195-usb-device-audio-streaming-expansion-package-for-stm32cube-stmicroelectronics.pdf
- Texas Instruments, TLV320AIC3104 product page and datasheet, covering codec
  I2C control, serial audio formats, supply domains, and audio capabilities:
  https://www.ti.com/product/TLV320AIC3104
