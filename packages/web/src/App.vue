<script setup lang="ts">
import MyWorker from './worker/index?worker'
import axios from "axios";

const handleUpload = async (e: any) => {
  const file = e.target.files[0];
  const worker = new MyWorker();

  worker.onmessage = async (e) => {
    const { fileHash, chunks, error } = e.data;
    if (error) {
      console.error('Worker error:', error);
      return;
    }

    // 继续处理 fileHash 和 chunks，如检查文件状态、上传切片等
    console.log('---切片后---', chunks)

    let chunkSignsArr = new Array(chunks.length).fill(0);
    /* 判断是否已有切片，有切片 (断点续传)，有完整文件 (秒传) */
    const { data } = await axios.get('http://localhost:3891/check-chunks?hash=' + fileHash + '&name=' + file.name + '&chunkTotal=' + chunks.length);
    if (data.uploadStatus === 'uploaded') {
      console.log('秒传');
      return;
    } else if (data.uploadStatus === 'uploading') {
      chunkSignsArr = [...data.chunkSignsArr]
    }


    /* 切片上传 */
    const tasks: any[] = [];
    chunks.map((chunk: Blob, index: number) => {
      if (chunkSignsArr[index] === 0) {
        const data = new FormData();
        data.set('name', fileHash + '_' + index)
        data.set('hash', fileHash as string)
        data.append('files', chunk);
        tasks.push(axios.post('http://localhost:3891/upload', data, {
          onUploadProgress: (progressEvent) => {
            console.log(`${index}上传进度:`, (progressEvent.loaded / progressEvent.total! * 100).toFixed(2) + '%');
          }
        }));
      }
    })
    await Promise.all(tasks);
    /* 合并切片 */
    axios.get('http://localhost:3891/merge?name=' + file.name + '&hash=' + fileHash);
  };

  worker.onerror = (error) => {
    console.error('Worker error:', error);
  };

  worker.postMessage({ file });
};


</script>

<template>
  <main>
    <input type="file" placeholder="请上传文件" @change="(e) => handleUpload(e)" />
  </main>
</template>
