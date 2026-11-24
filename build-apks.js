#!/usr/bin/env node

/**
 * ANI Enterprise ERP - Automated APK Builder for Dev & Main Environments
 * 
 * Usage:
 *   node build-apks.js dev   # Build dev APK (http://192.168.0.243:3000)
 *   node build-apks.js main  # Build main APK (http://189.31.39.166:3000)
 *   node build-apks.js all   # Build both dev and main APKs sequentially
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const ANDROID_DIR = path.join(CLIENT_DIR, 'android');
const STRINGS_XML_PATH = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const BUILD_GRADLE_PATH = path.join(ANDROID_DIR, 'app', 'build.gradle');
const CLIENT_CAP_CONFIG_PATH = path.join(CLIENT_DIR, 'capacitor.config.json');
const ROOT_CAP_CONFIG_PATH = path.join(ROOT_DIR, 'capacitor.config.json');
const BUILT_APK_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const CONFIGS = {
  dev: {
    target: 'dev',
    label: 'DEV',
    serverUrl: 'http://192.168.0.243:3000',
    appId: 'com.anienterprise.erp.dev',
    appName: 'ANI ERP Dev',
    outputName: 'ANI-ERP-Dev.apk',
    extraCopies: ['ANI-ERP.apk', 'ANI-Enterprise-ERP-MDM.apk']
  },
  main: {
    target: 'main',
    label: 'MAIN',
    serverUrl: 'http://189.31.39.166:3000',
    appId: 'com.anienterprise.erp',
    appName: 'ANI ERP',
    outputName: 'ANI-ERP-Main.apk',
    extraCopies: ['ANI-ERP.apk', 'ANI-Enterprise-ERP-MDM.apk']
  }
};

function formatSize(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function updateAndroidConfigs(config) {
  console.log(`\n========================================`);
  console.log(`⚙️  Configuring environment: ${config.label}`);
  console.log(`   Target Server: ${config.serverUrl}`);
  console.log(`   App ID:        ${config.appId}`);
  console.log(`   App Name:      ${config.appName}`);
  console.log(`========================================`);

  // 1. Update strings.xml
  const stringsContent = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${config.appName}</string>
    <string name="title_activity_main">${config.appName}</string>
    <string name="package_name">${config.appId}</string>
    <string name="custom_url_scheme">${config.appId}</string>
    <string name="server_url">${config.serverUrl}</string>
</resources>
`;
  fs.writeFileSync(STRINGS_XML_PATH, stringsContent, 'utf8');
  console.log(`✔ Updated strings.xml`);

  // 2. Update build.gradle applicationId
  let gradleContent = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
  gradleContent = gradleContent.replace(
    /applicationId\s+["'][^"']+["']/,
    `applicationId "${config.appId}"`
  );
  fs.writeFileSync(BUILD_GRADLE_PATH, gradleContent, 'utf8');
  console.log(`✔ Updated app/build.gradle (applicationId: ${config.appId})`);

  // 3. Update capacitor.config.json (both client and root)
  const updateCapConfig = (filePath) => {
    if (fs.existsSync(filePath)) {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      json.appId = config.appId;
      json.appName = config.appName;
      json.server = json.server || {};
      json.server.androidScheme = 'http';
      json.server.cleartext = true;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    }
  };
  updateCapConfig(CLIENT_CAP_CONFIG_PATH);
  updateCapConfig(ROOT_CAP_CONFIG_PATH);
  console.log(`✔ Updated capacitor.config.json`);
}

function buildApkForConfig(config) {
  const startTime = Date.now();
  updateAndroidConfigs(config);

  // Step A: Build Vite distribution with VITE_API_URL and VITE_DEV_MODE
  console.log(`\n📦 Step 1/3: Building Vite web assets (VITE_API_URL=${config.serverUrl}, target=${config.target})...`);
  execSync('npm run build', {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_API_URL: config.serverUrl,
      VITE_DEV_MODE: config.target === 'dev' ? 'true' : 'false',
      VITE_APP_ENV: config.target
    }
  });

  // Step B: Sync assets to native Android project
  console.log(`\n🔄 Step 2/3: Syncing web bundle to Android native platform...`);
  execSync('npx cap sync android', {
    cwd: CLIENT_DIR,
    stdio: 'inherit'
  });

  // Re-verify configs in case cap sync modified strings.xml
  updateAndroidConfigs(config);

  // Clean old APK before assemble
  if (fs.existsSync(BUILT_APK_PATH)) {
    fs.unlinkSync(BUILT_APK_PATH);
  }

  // Step C: Build APK via Gradle
  console.log(`\n🔨 Step 3/3: Assembling Android Debug APK via Gradle...`);
  execSync('./gradlew assembleDebug', {
    cwd: ANDROID_DIR,
    stdio: 'inherit'
  });

  if (!fs.existsSync(BUILT_APK_PATH)) {
    throw new Error(`Gradle build finished but APK not found at: ${BUILT_APK_PATH}`);
  }

  // Copy output APK to project root
  const primaryDest = path.join(ROOT_DIR, config.outputName);
  fs.copyFileSync(BUILT_APK_PATH, primaryDest);
  console.log(`\n🎉 Output generated: ${config.outputName} (${formatSize(fs.statSync(primaryDest).size)})`);

  for (const extra of config.extraCopies) {
    const extraDest = path.join(ROOT_DIR, extra);
    fs.copyFileSync(BUILT_APK_PATH, extraDest);
    console.log(`   Also updated:   ${extra}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Build for ${config.label} finished successfully in ${duration}s!`);
  console.log(`   SHA-256: ${getSha256(primaryDest)}`);
}

function main() {
  const target = (process.argv[2] || 'all').toLowerCase();

  console.log(`ANI Enterprise ERP - APK Builder`);
  console.log(`Requested target: ${target}`);

  if (target === 'dev') {
    buildApkForConfig(CONFIGS.dev);
  } else if (target === 'main') {
    buildApkForConfig(CONFIGS.main);
  } else if (target === 'all') {
    buildApkForConfig(CONFIGS.dev);
    buildApkForConfig(CONFIGS.main);
    console.log(`\n======================================================`);
    console.log(`🚀 BOTH DEV & MAIN APKS BUILT SUCCESSFULLY!`);
    console.log(`   DEV:  ${path.join(ROOT_DIR, CONFIGS.dev.outputName)} -> ${CONFIGS.dev.serverUrl}`);
    console.log(`   MAIN: ${path.join(ROOT_DIR, CONFIGS.main.outputName)} -> ${CONFIGS.main.serverUrl}`);
    console.log(`======================================================\n`);
  } else {
    console.error(`Unknown build target: "${target}". Valid targets are: dev, main, all`);
    process.exit(1);
  }
}

main();
