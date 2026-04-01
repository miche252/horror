# 🚀 WebRTC Signaling Server - Deployment Guide

## 📋 ما تحتاجه

### الخيار 1: Render.com (مجاني)

1. **أنشئ حساب على [Render.com](https://render.com)**

2. **ارفع الكود إلى GitHub:**
   - أنشئ repository جديد
   - ارفع محتوى `server/` folder:
     ```
     server/
     ├── package.json
     ├── webrtc_signaling_server.js
     └── render.yaml
     ```

3. **Deploy على Render:**
   - في Render Dashboard، اضغط "New Web Service"
   - اربط GitHub repo
   - Render سيقرأ `render.yaml` تلقائياً
   - اضغط "Deploy"

4. **احصل على URL:**
   - بعد نجاح الـ deploy، ستحصل على URL مثل:
     ```
     https://horror-webrtc-signaling.onrender.com
     ```

### الخيار 2: Railway.app (مجاني)

1. **أنشئ حساب على [Railway.app](https://railway.app)**

2. **ارفع الكود إلى GitHub**

3. **Deploy:**
   - New Project → Deploy from GitHub repo
   - Railway يكتشف Node.js تلقائياً
   - اضغط Deploy

### الخيار 3: Heroku (مدفوع/مجاني محدود)

```bash
# تثبيت Heroku CLI
npm install -g heroku

# تسجيل الدخول
heroku login

# إنشاء تطبيق
heroku create horror-webrtc-signaling

# رفع الكود
heroku git:remote -a horror-webrtc-signaling
git push heroku main
```

---

## ⚙️ إعدادات هامة

### متغيرات البيئة (Environment Variables)

| Variable | القيمة | الوصف |
|----------|--------|-------|
| `PORT` | `8080` | منفذ السيرفر |

### ports المفتوحة

- **WebSocket**: `8080` (أو أي PORT محدد)
- **HTTP**: نفس المنفذ للـ health checks

---

## 🔗 تحديث Godot Client

### للاختبار المحلي (Local):
```gdscript
NetworkManager.signaling_url = "ws://127.0.0.1:8080"
```

### للاستضافة (Production):
```gdscript
NetworkManager.signaling_url = "wss://your-app.onrender.com"
# أو
NetworkManager.signaling_url = "wss://your-app.railway.app"
```

⚠️ **مهم**: استخدم `wss://` (WebSocket Secure) مع الاستضافة، ليس `ws://`

---

## 🧪 اختبار الاتصال

### اختبار السيرفر:
```bash
curl https://your-app.onrender.com/
# يجب أن يرجع: "WebRTC Signaling Server is running."
```

### اختبار WebSocket:
```javascript
// في browser console
const ws = new WebSocket('wss://your-app.onrender.com');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

---

## 📱 إعدادات Mobile

### للـ Mobile (اختبار على نفس الشبكة):
```gdscript
# استخدم IP الخاص بالكمبيوتر
NetworkManager.signaling_url = "ws://192.168.1.XXX:8080"
```

### للـ Mobile (Production):
```gdscript
NetworkManager.signaling_url = "wss://your-app.onrender.com"
```

---

## 🐛 Troubleshooting

### المشكلة: "Connection failed"
- تأكد من أن السيرفر يعمل: `curl <url>`
- تأكد من استخدام `wss://` مع HTTPS
- تأكد من أن PORT مفتوح في Firewall

### المشكلة: "Room not found"
- تأكد من أن peer ينضم بعد إنشاء الغرفة
- تأكد من صحة room code (6 أرقام)

### المشكلة: Latency عالي
- Render.com Free: قد يكون بطيء (sleep after inactivity)
- Railway: أسرع قليلاً
- للألعاب الفعلية: استخدم paid plan

---

## 💰 التكلفة

| الخدمة | الخطة المجانية | الخطة المدفوعة |
|--------|---------------|---------------|
| Render | ✅ مجاني (يُنام after 15min) | $7/شهر |
| Railway | ✅ $5 credit شهرياً | حسب الاستخدام |
| Heroku | ❌ لا يوجد مجاني | $7/شهر |
| AWS | ❌ معقد | حسب الاستخدام |
| DigitalOcean | ❌ | $6/شهر |

---

## 🎮 جاهز للعب!

بعد الـ deploy:
1. Host يضغط "Create Room" ← يظهر room code
2. ينقل Room Code للـ Friends
3. Friends يضغطون "Join Room" ويدخلون الكود
4. الكل يضغط "Start Game"
5. 🎉 استمتعوا!

---

**تم التحديث:** 2025
**الإصدار:** 2.0.0 (WebRTC Support)
