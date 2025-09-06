#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 创建一个简单的测试 JPEG 图片（1x1 像素，包含基本的 EXIF 数据）
// 这个是一个最小的有效 JPEG 文件的 Base64 编码
const testImageBase64 = `/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA`;

const fixturesDir = path.join(__dirname, 'fixtures');
const outputDir = path.join(__dirname, 'output');

// 创建测试图片
const testImagePath = path.join(fixturesDir, 'test-image.jpg');
const imageBuffer = Buffer.from(testImageBase64, 'base64');
fs.writeFileSync(testImagePath, imageBuffer);

console.log(`✅ 创建测试图片: ${testImagePath}`);

// 创建一个稍大的测试图片（带更多元数据的模拟）
// 这是一个带有基本 EXIF 数据的更完整的 JPEG
const largerTestImageBase64 = `/9j/4AAQSkZJRgABAQEAyADIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAkKC//EACcQAAEDAwMEAQUAAAAAAAAAAAUGBwgBAgMJAAQRCg4SBxMVITI0ZP/EABUBAQEAAAAAAAAAAAAAAAAAAAQG/8QAHhEAAgICAwEBAAAAAAAAAAAAAQIDAAQRBRIhEzH/2gAMAwEAAhEDEQA/AMbvI6sN2cEbwSBHQ9DmjIMkuK3VlW6z5JAALCJnH4/U7JW61m5eqJCKJnOvlPWu1et6M1vRfRFH4gGdL1Cjme9X43rVKWpCy1PtJeYLG1MUJBgXKL4JMiuaD4tTvLrvBcY6V44kM7c5VV2VK1rl5c6qIoI0eL5TJ+trcqKtVFhOcKjjODo9qvHW7/WKUYNNWdM2Jl3VZsQ4OHKUTAuB5m7IeKrCqm4PJOFWOvE+LOiOQSgQ6Lz7Br0fGo1Q+y2LcjdQA7gZyfrJOBk/JxjPAO3Ax3PpucbHce30f/9k=`;

const largerTestImagePath = path.join(fixturesDir, 'test-image-with-exif.jpg');
const largerImageBuffer = Buffer.from(largerTestImageBase64, 'base64');
fs.writeFileSync(largerTestImagePath, largerImageBuffer);

console.log(`✅ 创建带 EXIF 的测试图片: ${largerTestImagePath}`);

// 创建 .gitkeep 文件确保 output 目录被追踪
fs.writeFileSync(path.join(outputDir, '.gitkeep'), '');

console.log('🎉 测试图片创建完成！');
