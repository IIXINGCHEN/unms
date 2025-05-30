#!/usr/bin/env node

/**
 * UNM-Server V2 环境检查脚本
 * 用于验证部署前的环境配置
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PLATFORMS = {
  vercel: '.env.vercel',
  netlify: '.env.netlify'
};

const REQUIRED_VARS = [
  'NODE_ENV',
  'ALLOWED_DOMAIN',
  'JWT_SECRET'
];

const RECOMMENDED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'CACHE_ENABLED',
  'GDSTUDIO_ENABLED'
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  });
  
  return env;
}

function checkEnvironment(platform, envFile) {
  console.log(`\n🔍 检查 ${platform.toUpperCase()} 环境配置...`);
  
  const env = parseEnvFile(envFile);
  if (!env) {
    console.log(`❌ 环境文件不存在: ${envFile}`);
    return false;
  }

  let hasErrors = false;
  let hasWarnings = false;

  // 检查必需变量
  console.log('\n📋 必需环境变量:');
  REQUIRED_VARS.forEach(varName => {
    const value = env[varName];
    if (!value || value === '') {
      console.log(`❌ ${varName}: 未设置或为空`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName}: 已设置`);
    }
  });

  // 检查推荐变量
  console.log('\n💡 推荐环境变量:');
  RECOMMENDED_VARS.forEach(varName => {
    const value = env[varName];
    if (!value || value === '') {
      console.log(`⚠️  ${varName}: 未设置 (推荐配置)`);
      hasWarnings = true;
    } else {
      console.log(`✅ ${varName}: 已设置`);
    }
  });

  // 平台特定检查
  console.log('\n🔧 平台特定检查:');
  
  if (platform === 'vercel') {
    // Vercel 特定检查
    if (env.PORT && env.PORT !== '3000') {
      console.log(`⚠️  PORT: 建议使用 3000 (当前: ${env.PORT})`);
      hasWarnings = true;
    }
    
    if (env.REDIS_ENABLED === 'true' && !env.REDIS_URL) {
      console.log(`⚠️  REDIS_URL: 启用了 Redis 但未配置连接`);
      hasWarnings = true;
    }
  }
  
  if (platform === 'netlify') {
    // Netlify 特定检查
    if (env.REDIS_ENABLED === 'true') {
      console.log(`💡 REDIS_ENABLED: Netlify Functions 建议使用内存缓存`);
    }
    
    if (env.PORT && env.PORT !== '8888') {
      console.log(`⚠️  PORT: 建议使用 8888 (当前: ${env.PORT})`);
      hasWarnings = true;
    }
  }

  // 安全检查
  console.log('\n🔒 安全配置检查:');
  
  if (env.ALLOWED_DOMAIN === '*') {
    console.log(`❌ ALLOWED_DOMAIN: 生产环境不应使用通配符`);
    hasErrors = true;
  }
  
  if (env.JWT_SECRET && env.JWT_SECRET.includes('change-this')) {
    console.log(`❌ JWT_SECRET: 请更改默认密钥`);
    hasErrors = true;
  }
  
  if (env.NODE_ENV !== 'production') {
    console.log(`⚠️  NODE_ENV: 建议设置为 production (当前: ${env.NODE_ENV})`);
    hasWarnings = true;
  }

  // 总结
  console.log('\n📊 检查结果:');
  if (hasErrors) {
    console.log(`❌ 发现 ${platform} 配置错误，请修复后重试`);
    return false;
  } else if (hasWarnings) {
    console.log(`⚠️  ${platform} 配置基本正确，但有一些建议优化`);
    return true;
  } else {
    console.log(`✅ ${platform} 配置完美！`);
    return true;
  }
}

function main() {
  console.log('🚀 UNM-Server V2 环境配置检查工具');
  
  const platform = process.argv[2];
  
  if (!platform) {
    console.log('\n📋 可用平台:');
    Object.keys(PLATFORMS).forEach(p => {
      const envFile = PLATFORMS[p];
      const exists = existsSync(envFile);
      console.log(`   ${p}: ${envFile} ${exists ? '✅' : '❌'}`);
    });
    
    console.log('\n💡 使用方法:');
    console.log('   node scripts/check-env.js vercel');
    console.log('   node scripts/check-env.js netlify');
    return;
  }
  
  if (!PLATFORMS[platform]) {
    console.log(`❌ 不支持的平台: ${platform}`);
    console.log(`支持的平台: ${Object.keys(PLATFORMS).join(', ')}`);
    process.exit(1);
  }
  
  const envFile = PLATFORMS[platform];
  const success = checkEnvironment(platform, envFile);
  
  if (!success) {
    process.exit(1);
  }
  
  console.log(`\n🎉 ${platform} 环境检查完成！`);
}

main();
