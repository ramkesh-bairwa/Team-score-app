declare module 'upng-js' {
  type Image = { width: number; height: number; depth: number; ctype: number; data: ArrayBuffer };
  const UPNG: {
    decode(buf: ArrayBuffer): Image;
    toRGBA8(img: Image): ArrayBuffer[];
    encode(frames: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
  };
  export default UPNG;
}
