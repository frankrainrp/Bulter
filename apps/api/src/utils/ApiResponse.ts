export function MakeOk<T>(data: T) {
  return {
    ok: true,
    data,
  };
}

export function MakeFail(message: string) {
  return {
    ok: false,
    error: message,
  };
}

