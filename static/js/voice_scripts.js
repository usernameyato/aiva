function scrollChatToBottom() {
  const chatWindow = document.getElementById("chat-window");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function typeWriter(element, text, i, speed) {
  if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(() => typeWriter(element, text, i, speed), speed);
      scrollChatToBottom();
  }
}

function displayMessage(role, content, typing = true) {
  const chatWindow = document.getElementById("chat-window");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.innerHTML = `<strong>${role.charAt(0).toUpperCase() + role.slice(1)}:</strong> <span class="message-content"></span>`;
  chatWindow.appendChild(messageDiv);
  scrollChatToBottom();
  const contentSpan = messageDiv.querySelector(".message-content");
  if (typing && role === "assistant") {
      typeWriter(contentSpan, content, 0, 15);
  } else {
      contentSpan.textContent = content;
  }
}

function showThinkingMessage() {
  const thoughts = [
      "Ой, интересный вопрос…",
      "Секундочку, подумаю…",
      "Хм… дай мне секунду.",
      "Загрузка мыслей…",
      "Обрабатываю мысли…",
      "Это заслуживает внимания…",
      "Я уже почти придумала ответ…",
      "Дай мне немного подумать…"
  ];
  const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];

  const chatWindow = document.getElementById("chat-window");
  const messageDiv = document.createElement("div");
  messageDiv.className = "message assistant loading";
  messageDiv.innerHTML = `
      <strong>Ассистент:</strong>
      <span class="dots-thinking">${randomThought}
          <span class="dot1">.</span>
          <span class="dot2">.</span>
          <span class="dot3">.</span>
      </span>`;
  messageDiv.id = "thinking-message";
  chatWindow.appendChild(messageDiv);
  scrollChatToBottom();
}



function replaceLastAssistantMessage(newText) {
  const loading = document.getElementById("thinking-message");
  if (loading) {
      const span = loading.querySelector(".dots-thinking");
      if (span) span.remove(); // убираем "думаю..."
      const container = loading.querySelector("strong");
      loading.innerHTML = `<strong>Ассистент:</strong> <span class="message-content"></span>`;
      const contentSpan = loading.querySelector(".message-content");
      typeWriter(contentSpan, newText, 0, 15);
      loading.id = ""; // больше не "loading"
      loading.classList.remove("loading");
  }
}


// function pollAudio(taskId, segments) {
//     const interval = setInterval(async () => {
//         const res = await fetch(`/get_audio?task_id=${taskId}`);
//         if (res.status === 200) {
//             const blob = await res.blob();
//             const url  = URL.createObjectURL(blob);
//             playAudio(url, segments);
//             clearInterval(interval);
//         }
//     }, 500);
// }
function pollAudio(taskId) {
  const interval = setInterval(async () => {
    const resAudio = await fetch(`/get_audio?task_id=${taskId}`);
    if (resAudio.status === 200) {
      clearInterval(interval);
      const audioBlob = await resAudio.blob();
      const url = URL.createObjectURL(audioBlob);

      // теперь запрашиваем сегменты
      const resSeg = await fetch(`/get_segments?task_id=${taskId}`);
      if (resSeg.status === 200) {
        const { segments } = await resSeg.json();
        playAudio(url, segments);
      } else {
        console.warn("Не удалось получить segments, играем без липсинка");
        playAudio(url, []);
      }

    } else if (resAudio.status !== 202) {
      clearInterval(interval);
      console.warn("Аудио не удалось получить:", resAudio.status);
    }
    // при 202 — ждём
  }, 500);
}



let currentAudio = null;
let feedbackAudio = null;


// playAudio передаёт segments дальше
function playAudio(url, segments) {
    if (currentAudio) currentAudio.pause();
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play();
    attachLipSyncToAudio(audio, segments);
    audio.onended = () => currentAudio = null;
}

/**
 * Улучшенный липсинк на чистом аудиосигнале.
 * Не требует никакого внешнего alignment.
 *
 * @param {HTMLMediaElement} audioElement — audio/video элемент.
 */
 // Расширяем attachLipSyncToAudio
 function attachLipSyncToAudio(audioElement, segments = []) {
   if (!segments.length) return;
   if (!window.lipSyncTargets) return;

   const headKeys  = Object.keys(window.lipSyncTargets.head);
   const teethKeys = Object.keys(window.lipSyncTargets.teeth);

   let idx = 0;
   let currentViseme = null;
   let lastSwitchTime = 0;

   const ctx      = new AudioContext();
   const src      = ctx.createMediaElementSource(audioElement);
   const analyser = ctx.createAnalyser();
   src.connect(analyser);
   analyser.connect(ctx.destination);
   analyser.fftSize = 256;

   const smoothSpeed = 0.2;       // чем меньше — тем плавнее
   const minHoldTime  = 0.05;     // сек, минимальное время удержания висемы

   function animate() {
     const t = audioElement.currentTime;

     // на каждом кадре ищем «активную» сегментную висему
     let nextViseme = null;
     while (idx < segments.length && segments[idx].begin <= t) {
       nextViseme = segments[idx++].viseme;
     }

     // если висема сменилась и прошло достаточно времени — переключаем
     if (nextViseme && nextViseme !== currentViseme
         && t - lastSwitchTime > minHoldTime) {
       currentViseme   = nextViseme;
       lastSwitchTime  = t;
     }

     // Плавно интерполируем все morph-таргеты к нужным значениям
     headKeys.concat(teethKeys).forEach(k => {
       const target = (k === currentViseme) ? 1 : 0;
       setMorphSmooth(k, target, smoothSpeed);
     });

     // рот и челюсть по амплитуде (можно оставить как есть)
     // … ваш код с analyser.getByteFrequencyData() и setMorphSmooth("mouthOpen", …)

     if (!audioElement.paused) {
       requestAnimationFrame(animate);
     } else {
       // после паузы — плавно сбрасываем
       setTimeout(() => {
         headKeys.concat(teethKeys).forEach(k => setMorphSmooth(k, 0, smoothSpeed));
         setMorphSmooth("mouthOpen", 0, smoothSpeed);
         setMorphSmooth("jawOpen",   0, smoothSpeed);
       }, 200);
     }
   }

   requestAnimationFrame(animate);
   // Когда аудио полностью закончилось — закрываем рот
   audioElement.addEventListener("ended", () => {
       // сброс всех viseme
       headKeys.concat(teethKeys).forEach(k => setMorph(k, 0));
       // плавно закрываем рот и челюсть
       setMorph("mouthOpen", 0);
       setMorph("jawOpen", 0);
    });
 }




function playFeedbackAudio(url, onEnd = null) {
  if (feedbackAudio) {
      feedbackAudio.pause();
      feedbackAudio = null;
  }

  const audio = new Audio(url);
  feedbackAudio = audio;
  audio.play();

  audio.onended = () => {
      feedbackAudio = null;
      if (typeof onEnd === "function") onEnd();
  };
}



document.addEventListener("DOMContentLoaded", () => {
  let recognitionRunning = false;
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  stopBtn.addEventListener("click", () => {
      if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio = null;
      }
      if (feedbackAudio) {
          feedbackAudio.pause();
          feedbackAudio.currentTime = 0;
          feedbackAudio = null;
      }
  });



  scrollChatToBottom();

  chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userMessage = messageInput.value.trim();
      if (!userMessage) return;

      displayMessage("user", userMessage, false);
      messageInput.value = "";
      sendBtn.disabled = true;
      showThinkingMessage();

      try {
          const response = await fetch("/send_message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: userMessage })
          });

          const data = await response.json();
          if (data.response) {
              replaceLastAssistantMessage(data.response);
              if (data.task_id) {
                  pollAudio(data.task_id, data.segments);
              }
          } else {
              replaceLastAssistantMessage("Ошибка в ответе от Эйвы.");
          }
      } catch (error) {
          console.error("Ошибка:", error);
          replaceLastAssistantMessage("Произошла ошибка. Попробуй ещё раз.");
      } finally {
          sendBtn.disabled = false;
          messageInput.focus();
      }
  });

  // Голосовой ввод
  const recordBtn = document.getElementById("record-btn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let isWakeMode = true;

      function startWakeMode() {
          if (recognitionRunning) {
              console.warn("⚠️ Распознавание уже активно — повторный запуск отменён.");
              return;
          }
          isWakeMode = true;
          recognition.continuous = true;
          try {
              recognition.start();
              recognitionRunning = true;
              console.log("👂 Жду 'привет эйва'...");
          } catch (e) {
              console.warn("⛔ Ошибка старта wakeMode:", e.message);
          }
      }


      function startCommandMode() {
          if (recognitionRunning) {
              console.warn("⚠️ Распознавание уже активно — повторный запуск отменён.");
              return;
          }

          isWakeMode = false;
          recognition.continuous = false;
          recordBtn.disabled = true;
          recordBtn.textContent = "🎙 Слушаю...";

          playFeedbackAudio("/static/audio/listening.wav", () => {
              try {
                  recognition.start();
                  recognitionRunning = true;
              } catch (e) {
                  console.warn("⛔ Ошибка старта командного режима:", e.message);
              }
          });

          if (currentAudio) {
              currentAudio.onended = () => {
                  try {
                      recognition.start();
                      recognitionRunning = true;
                  } catch (e) {
                      console.warn("⛔ Ошибка старта после озвучки:", e.message);
                  }
              };
          }
      }



      recognition.onresult = (event) => {
          const result = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
          console.log("Распознано:", result);

          // 📦 Фильтруем "я слушаю", чтобы не отправлялось
          const bannedPhrases = [
              "я слушаю", "говори я вся во внимании", "окей я тебя слушаю",
              "что бы ты хотел узнать", "да я здесь", "готова помочь", "угу я тут говори"
          ];

          if (bannedPhrases.some(phrase => result.includes(phrase))) {
              console.log("🛑 Системная фраза проигнорирована");
              return;
          }

          if (isWakeMode) {
              if (result.includes("привет эйва")) {
                  console.log("✨ Активация голосом");
                  recognition.stop();
                  setTimeout(startCommandMode, 700); // задержка перед распознаванием
              }
          } else {
              messageInput.value = result;
              document.getElementById("send-btn").click();
              recognition.stop(); // 🛑 добавляем остановку вручную
          }
      };


      recognition.onstart = () => {
          recognitionRunning = true;
      };

      recognition.onend = () => {
          recognitionRunning = false;
          if (isWakeMode) {
              setTimeout(() => {
                  try {
                      recognition.start();
                      recognitionRunning = true;
                  } catch (e) {
                      // console.warn("⛔ Ошибка рестарта в wake:", e.message);
                  }
              }, 1000);
          } else {
              recordBtn.disabled = false;
              recordBtn.textContent = "🎤";
              startWakeMode();
          }
      };

      recognition.onerror = (event) => {
          recognitionRunning = false;

          switch (event.error) {
              case "no-speech":
                  console.warn("⚠️ Нет речи — тишина, жду...");
                  break;
              case "network":
                  console.warn("⚠️ Проблема с сетью");
                  break;
              case "not-allowed":
                  console.warn("⛔ Доступ к микрофону запрещён");
                  break;
              default:
                  console.warn("❗ Произошла ошибка распознавания:", event.error);
          }

          if (!isWakeMode) {
              recordBtn.disabled = false;
              recordBtn.textContent = "🎤";
          }

          if (isWakeMode) {
              setTimeout(() => {
                  try {
                      recognition.start();
                      recognitionRunning = true;
                  } catch (e) {
                      console.warn("⚠️ Не удалось перезапустить слушание:", e.message);
                  }
              }, 1000);
          }
      };




      recordBtn.addEventListener("click", () => {
          recognition.stop(); // на всякий случай
          setTimeout(() => {
              startCommandMode();
          }, 1000); // ⏱ задержка 1000 мс
      });


      startWakeMode();
  } else {
      const recordBtn = document.getElementById("record-btn");
      recordBtn.disabled = true;
      recordBtn.textContent = "Голосовой ввод не поддерживается";
  }

});
