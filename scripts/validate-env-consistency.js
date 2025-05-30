#!/usr/bin/env node

/**
 * UNM-Server V2 环境配置一致性验证脚本
 * 验证所有环境配置文件是否包含相同的配置项
 */

import { readFileSync, existsSync } from 'fs';

const ENV_FILES = [
  '.env.example',
  '.env.development', 
  '.env.production',
  '.env.vercel',
  '.env.netlify'
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const keys = new Set();
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key] = line.split('=');
      if (key) {
        keys.add(key.trim());
      }
    }
  });
  
  return keys;
}

function main() {
  console.log('🔍 UNM-Server V2 环境配置一致性验证');
  console.log('');

  const envConfigs = {};
  const allKeys = new Set();

  // 解析所有环境文件
  ENV_FILES.forEach(file => {
    const keys = parseEnvFile(file);
    if (keys) {
      envConfigs[file] = keys;
      keys.forEach(key => allKeys.add(key));
      console.log(`✅ ${file}: ${keys.size} 个配置项`);
    } else {
      console.log(`❌ ${file}: 文件不存在`);
    }
  });

  console.log('');
  console.log(`📊 总计发现 ${allKeys.size} 个不同的配置项`);
  console.log('');

  // 检查一致性
  let hasInconsistency = false;
  const sortedKeys = Array.from(allKeys).sort();

  console.log('🔍 检查配置项一致性:');
  console.log('');

  sortedKeys.forEach(key => {
    const filesWithKey = [];
    const filesWithoutKey = [];

    ENV_FILES.forEach(file => {
      if (envConfigs[file]) {
        if (envConfigs[file].has(key)) {
          filesWithKey.push(file);
        } else {
          filesWithoutKey.push(file);
        }
      }
    });

    if (filesWithoutKey.length > 0) {
      hasInconsistency = true;
      console.log(`⚠️  ${key}:`);
      console.log(`   ✅ 存在于: ${filesWithKey.join(', ')}`);
      console.log(`   ❌ 缺失于: ${filesWithoutKey.join(', ')}`);
      console.log('');
    }
  });

  if (!hasInconsistency) {
    console.log('🎉 所有环境配置文件的配置项完全一致！');
  } else {
    console.log('❌ 发现配置项不一致，请修复上述问题');
  }

  console.log('');
  console.log('📋 配置文件对比:');
  ENV_FILES.forEach(file => {
    if (envConfigs[file]) {
      console.log(`   ${file}: ${envConfigs[file].size} 项`);
    }
  });

  process.exit(hasInconsistency ? 1 : 0);
}

main();
