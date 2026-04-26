# AudioLab Software Architecture Specification

## 1. Purpose

This document defines the host-side software architecture for AudioLab. It
describes the PC software responsibilities, module boundaries, device-control
model, command protocol expectations, diagnostics workflow, measurement support,
error handling, testing strategy, and future source organization.

This document is separate from the firmware architecture. The host software
configures, observes, and validates the embedded device; it does not own
real-time audio transport, codec register timing, DMA, or hardware fault
recovery.

## 2. Software Scope

The host-side software runs on a PC connected to the AudioLab device over USB.

The software scope includes:

- device discovery;
- connection management;
- host-control command encoding and decoding;
- device status inspection;
- codec and DSP configuration workflows;
- diagnostics and fault reporting;
- measurement orchestration;
- repeatable validation commands;
- machine-readable output for tests and reports;
- optional interactive user interface after the command-line workflow is stable.

The software scope does not include:

- STM32 firmware implementation;
- USB Audio endpoint implementation inside firmware;
- codec register access timing;
- PCB design;
- analog measurement hardware;
- audio driver development for the host operating system.

## 3. Software Goals

The host software shall:

- make common bring-up and validation operations repeatable;
- provide actionable errors when the device is missing, busy, or in a fault state;
- avoid requiring custom kernel drivers for the planned control path where
  practical;
- distinguish planned behavior from validated behavior;
- keep command schemas stable once firmware and host agree on a protocol;
- provide human-readable and machine-readable output modes;
- keep measurement and reporting code separate from low-level transport code;
- avoid hiding firmware or hardware failures behind automatic fallbacks.

## 4. Baseline Operating Model

The first host-side implementation should be a command-line utility plus a small
library. A GUI may be added later only after the CLI workflows and device
protocol are stable.

Baseline workflows:

```text
discover device
  -> read device identity
  -> read firmware and hardware status
  -> select codec/audio mode
  -> configure DSP mode or bypass
  -> start or observe host audio workflow
  -> collect diagnostics
  -> run validation or measurement helper
  -> export result
```

The host software should not attempt to be a full digital audio workstation. The
PC operating system's normal audio stack remains responsible for user audio
playback and capture. AudioLab host software controls and validates the device.

## 5. Architecture Layers

The host software shall use the following logical layers:

```text
interface
  CLI commands, optional future GUI, output formatting

application
  workflows for bring-up, configuration, diagnostics, and measurement

domain
  typed device model, command model, status model, measurement model

transport
  USB HID, CDC, vendor-specific USB, or selected control-channel adapter

support
  logging, configuration files, serialization, test fixtures
```

Interface code may call application workflows. Application workflows operate on
domain models and transport interfaces. Domain logic shall not depend on a
specific USB backend. Transport code shall not contain user workflow policy.

## 6. Module Responsibilities

### 6.1 Device Discovery Module

The discovery module owns finding candidate AudioLab devices.

It shall:

- enumerate available devices for the selected control transport;
- match devices by stable identifiers once firmware exposes them;
- report no-device and multiple-device cases explicitly;
- avoid selecting an ambiguous device silently;
- expose enough metadata for diagnostics, such as transport path, serial number,
  firmware version, and reported capabilities when available.

### 6.2 Transport Module

The transport module owns raw communication with the device control interface.

The selected transport may be:

- HID;
- CDC serial;
- vendor-specific USB;
- another firmware-supported class control path.

The transport module shall:

- open and close device connections;
- perform request/response exchanges;
- enforce read and write timeouts;
- preserve packet boundaries when the transport requires them;
- translate transport errors into typed software errors;
- avoid embedding command semantics beyond framing and delivery.

The transport module shall not directly modify codec, DSP, or streaming state.

### 6.3 Protocol Module

The protocol module owns command encoding, command decoding, response decoding,
version compatibility, and schema validation.

It shall define typed messages for:

- device identity;
- device status;
- firmware version and build information;
- codec mode selection;
- mute and gain control;
- DSP mode selection;
- DSP parameter update;
- diagnostics counters;
- fault clear or controlled reinitialization;
- measurement setup where firmware support exists.

Protocol handling shall:

- validate command IDs;
- validate payload sizes;
- validate numeric ranges before sending commands;
- reject unsupported protocol versions explicitly;
- preserve unknown response fields only when forward compatibility is intended;
- distinguish device-level errors from host transport failures.

### 6.4 Device Model Module

The device model represents the current known state of an AudioLab device.

It shall model:

- connection state;
- firmware version;
- hardware revision when available;
- active sample rate;
- active channel count;
- active codec mode;
- active DSP mode;
- mute and gain state;
- streaming state;
- diagnostics counters;
- last fault.

The model shall distinguish:

- unknown state;
- planned state requested by the host;
- confirmed state reported by firmware;
- stale state after reconnect or timeout.

### 6.5 Configuration Module

The configuration module owns user-selected presets and reusable command
profiles.

It should support:

- named codec modes;
- named DSP presets;
- validation profiles;
- output format preferences;
- device-selection preferences.

Configuration files shall be explicit and portable. They shall not store secrets,
host-specific absolute paths, or hidden calibration assumptions unless a later
workflow requires them and documents them.

### 6.6 Diagnostics Module

The diagnostics module owns status collection and presentation.

It shall collect:

- device identity;
- USB/control transport state;
- firmware state machine state;
- codec initialization state;
- active audio mode;
- DMA and buffer counters when firmware exposes them;
- underrun and overrun counters;
- I2C error counters;
- active DSP mode and parameter summary;
- last fault and recovery status.

Diagnostics output shall support:

- concise human-readable text;
- structured output suitable for tests and reports.

### 6.7 Measurement Module

The measurement module owns repeatable measurement workflows that the PC can
coordinate.

Initial measurement workflows may include:

- playback test-tone setup;
- capture sanity check;
- loopback observation workflow;
- latency measurement helper;
- level or peak/RMS estimation from captured audio files;
- rail-current recording prompts or result capture;
- report artifact generation.

The measurement module may invoke host audio tools or read recorded audio files,
but it shall keep those integrations behind adapters so the core workflow remains
testable.

The software shall not claim an audio-quality metric unless the measurement
method and input data are recorded.

### 6.8 CLI Module

The CLI module is the preferred first user interface.

Recommended command groups:

```text
audiolab device list
audiolab device info
audiolab status
audiolab codec preset <name>
audiolab dsp list
audiolab dsp set <name>
audiolab dsp param <key> <value>
audiolab mute on|off
audiolab gain set <target> <value>
audiolab diagnostics dump
audiolab fault clear
audiolab validate <profile>
audiolab measure <workflow>
```

The CLI shall:

- return nonzero exit status on failure;
- print actionable error messages;
- support structured output where practical;
- avoid interactive prompts in commands intended for tests;
- avoid surprising device state changes for read-only commands.

### 6.9 Optional UI Module

A GUI or web interface may be added after the CLI and protocol are stable.

Any UI shall reuse the application and domain layers rather than reimplementing
device protocol logic. UI controls shall reflect confirmed device state and
report failed commands visibly.

## 7. Host-Control Contract

The host-control contract is a boundary shared with firmware.

The contract shall define:

- transport type;
- device identification method;
- command framing;
- endianness;
- integer sizes;
- string encoding;
- maximum packet or message length;
- command IDs;
- response IDs;
- error codes;
- version negotiation;
- timeout behavior;
- retry policy;
- which commands are legal in each firmware state.

Until the final control transport is selected, the software architecture shall
assume a request/response model with explicit status for every command.

The host software shall never assume that a command succeeded only because bytes
were written to the transport.

## 8. Error Model

The host software shall use typed errors.

Required error categories:

- no matching device;
- multiple matching devices;
- permission or access failure;
- transport open failure;
- transport timeout;
- malformed device response;
- unsupported protocol version;
- device returned error status;
- command not allowed in current firmware state;
- invalid user input;
- measurement dependency missing;
- validation failed.

Each user-facing error shall include:

- what failed;
- why it likely failed when known;
- the smallest useful next action.

The software shall not silently retry state-changing commands unless the command
is explicitly idempotent or the retry policy is documented.

## 9. Data and Output Formats

The host software shall support human-readable output for interactive use and
structured output for validation and reports.

Recommended structured output format:

```text
JSON object per command result
```

Structured output shall include:

- command name;
- success flag;
- device identity when available;
- timestamp when relevant;
- result payload;
- error code and message on failure.

Output formats used by tests or reports shall be treated as compatibility
surfaces once published.

## 10. Security and Safety Considerations

The host software controls hardware state and audio output behavior. It shall
treat device commands as a safety-relevant interface.

The software shall:

- validate all user input before sending commands;
- constrain gain, mute, routing, and DSP parameter ranges;
- make state-changing commands explicit;
- avoid raw codec writes in normal workflows;
- clearly mark any diagnostic raw access as advanced and potentially unsafe;
- avoid logging unrelated host system information;
- avoid storing secrets or credentials;
- fail closed when command validation fails.

Commands that can affect analog outputs shall prefer safe transitions, such as
muting before mode changes when firmware supports it.

## 11. Software Source Layout

The future host software project should live under `software/host/`.

Recommended source layout:

```text
software/host/
  audiolab/
    interface/
    application/
    domain/
    transport/
    diagnostics/
    measurement/
    support/
  tests/
  pyproject.toml
```

Python is the preferred first implementation language for the host utility
because the project needs scripting, validation, reporting, and lab workflow
automation more than a performance-critical host application.

Directory roles:

- `audiolab/interface/`: CLI and optional future UI adapters.
- `audiolab/application/`: use cases and workflows.
- `audiolab/domain/`: typed command, status, configuration, and measurement
  models.
- `audiolab/transport/`: USB/control transport implementations.
- `audiolab/diagnostics/`: status collection and presentation helpers.
- `audiolab/measurement/`: measurement workflows and result processing.
- `audiolab/support/`: logging, serialization, configuration, and shared utility
  code.
- `tests/`: host-software unit and integration tests.

If a later GUI is added, it should be a separate interface adapter using the same
application and domain layers.

## 12. Testing Strategy

Host software tests shall cover:

- command encoding and decoding;
- protocol version handling;
- response parsing;
- invalid payload rejection;
- transport timeout behavior using fake transports;
- device discovery edge cases;
- CLI argument validation;
- structured output stability;
- diagnostics formatting;
- measurement workflow logic with fixture data.

Tests that require real hardware shall be marked separately from unit tests.

The test strategy should include:

- pure unit tests for domain and protocol logic;
- fake-transport tests for application workflows;
- CLI invocation tests for user-facing behavior;
- optional hardware-in-the-loop tests once firmware and hardware exist.

## 13. Validation Plan

Software validation shall proceed in stages:

1. run unit tests for protocol and domain logic;
2. run CLI tests against fake transport;
3. connect to firmware stub or loopback transport;
4. discover a real device;
5. read device identity and status;
6. exercise safe read-only diagnostics;
7. exercise codec and DSP configuration commands;
8. validate malformed command rejection;
9. run a measurement workflow with known fixture data;
10. run a hardware-connected validation profile.

The software shall not be considered ready for hardware bring-up until it can
report connection, status, command failure, and invalid-input cases clearly.

## 14. Open Decisions

The following software decisions remain open:

- final control transport: HID, CDC, vendor-specific USB, or class extension;
- protocol framing and versioning details;
- exact command and error-code set;
- Python package and dependency choices;
- CLI framework choice;
- structured output schema;
- measurement file formats;
- whether audio capture/playback automation uses OS tools, Python libraries, or
  external lab equipment exports;
- hardware-in-the-loop test approach;
- whether a GUI is in scope after the CLI stabilizes.

## 15. References

- AudioLab system requirements specification:
  `docs/specs/system/requirements.md`
- AudioLab firmware architecture specification:
  `docs/specs/firmware/architecture.md`
