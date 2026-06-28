declare module 'browser-image-compression' {
  interface ImageCompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    fileType?: string;
    initialQuality?: number;
  }

  function imageCompression(file: File, options?: ImageCompressionOptions): Promise<File>;
  export { imageCompression };
}
