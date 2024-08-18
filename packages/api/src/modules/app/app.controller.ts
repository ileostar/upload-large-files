import { Body, Controller, Get, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      dest: 'uploads',
    }),
  )
  uploadFile(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() { name, hash }: { name: string; hash: string },
  ) {
    const chunkDir = 'uploads/' + hash;

    // 判断文件夹是否存在
    if (!fs.existsSync(chunkDir)) {
      // 创建文件夹
      fs.mkdirSync(chunkDir);
    }
    // 拷贝文件
    console.log('files[0].path', files[0].path)
    fs.cpSync(files[0].path, chunkDir + '/' + name);
    // 删除文件
    fs.rmSync(files[0].path);
  }

  /* 合并文件 */
  @Get('merge')
  merge(
    @Query('name') name: string,
    @Query('hash') hash: string
  ) {
    // 获取文件夹
    const chunkDir = 'uploads/' + hash;
    const files = fs.readdirSync(chunkDir);

    // 文件排序
    files.sort((f1, f2) => {
      const idx1 = +f1.split('_').at(-1);
      const idx2 = +f2.split('_').at(-1);
      return idx1 < idx2 ? -1 : idx1 > idx2 ? 1 : 0;
    });

    // 切片合并
    let count = 0;
    let startPos = 0;
    files.map((file) => {
      const filePath = chunkDir + '/' + file;
      const stream = fs.createReadStream(filePath);
      stream
        .pipe(
          fs.createWriteStream('uploads/' + hash + '-' + name, {
            start: startPos,
          }),
        )
        .on('finish', () => {
          count++;
          if (count === files.length) {
            fs.rm(
              chunkDir,
              {
                recursive: true,
              },
              () => {},
            );
          }
        });
      startPos += fs.statSync(filePath).size;
    });
  }

  /* 检查已上传文件或者切片 */
  @Get('check-chunks')
  checkChunks(
    @Query('hash') hash: string,
    @Query('name') name: string,
    @Query('chunkTotal') chunkTotal: string
  ) {
    // 获取切片文件夹、或文件
    const vo = {
      uploadStatus: 'empty',
      chunkSignsArr: [],
    };

    const fileDir = 'uploads/' + hash + '-' + name;
    // 有文件，说明文件已经上传且合并，返回上传成功 (秒传)
    if (fs.existsSync(fileDir)) {
      vo.uploadStatus = 'uploaded';
    }

    const chunkDir = 'uploads/' + hash;
    let directory;
    if (fs.existsSync(chunkDir)) {
      directory = fs.readdirSync(chunkDir);
      const chunkSignsArr = new Array<number>(+chunkTotal).fill(0);
      // 有文件夹，说明切片未完全上传，正序返回切片排序 (断点续传)
      if (directory?.length > 0) {
        directory.map((file) => {
          const idx = +file.split('_').at(-1);
          chunkSignsArr[idx] = 1;
        });
        vo.uploadStatus = 'uploading';
      }
      vo.chunkSignsArr = chunkSignsArr;
    }

    return vo;
  }
}
