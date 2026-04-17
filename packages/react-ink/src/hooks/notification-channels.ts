import type { OSCVariant } from "../context/providers/NotificationProvider";

type ProcessWithStdout = {
  process?: {
    stdout?: {
      write: (value: string) => unknown;
    };
  };
};

const writeToStdout = (value: string) => {
  const stdout = (globalThis as ProcessWithStdout).process?.stdout;
  stdout?.write(value);
};

const sanitizeOSCText = (value: string) => {
  return value.replaceAll("\x07", "").replaceAll("\x1b", "");
};

export const ringBell = () => {
  writeToStdout("\x07");
};

export const sendOSCNotification = (
  title: string,
  body?: string,
  variant: OSCVariant = "osc9",
) => {
  const sanitizedTitle = sanitizeOSCText(title);
  const sanitizedBody = body ? sanitizeOSCText(body) : undefined;
  const message = sanitizedBody ?? sanitizedTitle;

  switch (variant) {
    case "osc99":
      writeToStdout(`\x1b]99;i=1:d=0;${message}\x1b\\`);
      return;
    case "osc777":
      writeToStdout(
        `\x1b]777;notify;${sanitizedTitle};${sanitizedBody ?? ""}\x07`,
      );
      return;
    default:
      writeToStdout(`\x1b]9;${message}\x07`);
  }
};
