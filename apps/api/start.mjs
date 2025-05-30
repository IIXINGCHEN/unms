// 简单的启动脚本，手动替换模块路径
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取编译后的文件并替换导入路径
const indexPath = path.join(__dirname, 'dist', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 替换路径映射
content = content.replace(
  /from '@unm\/config'/g,
  "from '../../../packages/config/dist/src/index.js'"
);
content = content.replace(
  /from '@unm\/shared'/g,
  "from '../../../packages/shared/dist/index.js'"
);

// 写入临时文件
const tempPath = path.join(__dirname, 'dist', 'index.temp.js');
fs.writeFileSync(tempPath, content);

// 导入临时文件
await import('./dist/index.temp.js');
