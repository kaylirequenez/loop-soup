/// <reference types="vite/client" />

interface SerialPortOpenOptions {
  baudRate: number;
}

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  getInfo?(): {
    usbVendorId?: number;
    usbProductId?: number;
  };
  open(options: SerialPortOpenOptions): Promise<void>;
}

interface Serial {
  getPorts(): Promise<SerialPort[]>;
  requestPort(): Promise<SerialPort>;
}

interface Navigator {
  readonly serial: Serial;
}
