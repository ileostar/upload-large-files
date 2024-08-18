import SparkMD5 from "spark-md5";

self.onmessage = async (e) => {
  console.log('worker data', e)
  const { file } = e.data;
  try {
    const fileHash = await getFileHash(file);
    const chunks = spiltFiles(file);
    self.postMessage({ fileHash, chunks });
  } catch (error) {
    self.postMessage({ error: error?.toString() });
  }
};

/** 文件切片 */
const spiltFiles = (file: File, size = 1 * 1024 * 1024) => {
  const chunks = [];
  let startPos = 0;
  while (startPos < file.size) {
    chunks.push(file.slice(startPos, startPos + size))
    startPos += size
  }
  return chunks
}

/* 通过 md5 加密文件 buffer 来生成唯一 hash 值  */
const getFileHash = async (file: Blob) => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const fileHash = SparkMD5.ArrayBuffer.hash(e.target?.result as ArrayBuffer);
      resolve(fileHash);
    }
    fileReader.onerror = () => {
      reject('文件读取失败');
    }
    fileReader.readAsArrayBuffer(file);
  })
}
