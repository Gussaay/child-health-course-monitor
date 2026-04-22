const fs = require('fs');
const path = require('path');

// The exact path to the broken Java file
const filePath = path.join(__dirname, 'node_modules', '@capgo', 'capacitor-updater', 'android', 'src', 'main', 'java', 'ee', 'forgr', 'capacitor_updater', 'DelayUpdateUtils.java');

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the broken syntax with the correct syntax
    content = content.replace(/case DelayUntilNext\.background:/g, 'case background:');
    content = content.replace(/case DelayUntilNext\.kill:/g, 'case kill:');
    content = content.replace(/case DelayUntilNext\.date:/g, 'case date:');
    content = content.replace(/case DelayUntilNext\.nativeVersion:/g, 'case nativeVersion:');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully fixed the Capgo Capacitor Updater Java bug!');
} else {
    console.log('⚠️ Capgo file not found, skipping fix.');
}