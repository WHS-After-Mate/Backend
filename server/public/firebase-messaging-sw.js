// FCM 웹 푸시 테스트용 서비스워커. 브라우저 탭이 백그라운드/닫힌 상태일 때도
// 알림을 표시하려면 이 파일이 사이트 루트(/firebase-messaging-sw.js)에 있어야 한다.
//
// onBackgroundMessage 핸들러를 일부러 등록하지 않는다 — 우리가 보내는 메시지엔 항상
// notification 필드가 있어서(push.service.ts), 이 서비스워커가 firebase.messaging()으로
// 초기화돼 있기만 하면 SDK가 자동으로 알림을 띄운다. onBackgroundMessage까지 등록하면
// SDK 자동 표시 + 핸들러 수동 표시가 겹쳐 알림이 2개씩 뜬다(직접 겪은 버그).
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBttVzV1R99FtqRkZVnkkfVMAWgeFwYWWY",
  authDomain: "ms-project-da87f.firebaseapp.com",
  projectId: "ms-project-da87f",
  storageBucket: "ms-project-da87f.firebasestorage.app",
  messagingSenderId: "248951374187",
  appId: "1:248951374187:web:4c0f31acee70dd76c9cc2e",
});

firebase.messaging();
