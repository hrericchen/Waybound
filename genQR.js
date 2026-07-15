const QRCode = require('qrcode');
const url = 'exp://5wsuvxc.anonymous.19000.exp.direct';
QRCode.toFile('expo-qr.png', url, { type: 'png', width: 400 }, function (err) {
  if (err) {
    console.error('QR error', err);
    process.exit(1);
  }
  console.log('QR saved');
});
