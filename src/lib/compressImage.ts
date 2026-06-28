import imageCompression from 'browser-image-compression';

export async function compressStudentPhoto(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  };

  try {
    console.log(`Original file size: ${(file.size / 1024).toFixed(1)}KB`);
    const compressedFile = await imageCompression(file, options);
    console.log(`Compressed file size: ${(compressedFile.size / 1024).toFixed(1)}KB`);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file;
  }
}
