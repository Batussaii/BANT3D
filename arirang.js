(() => {
  const form = document.getElementById("arirangForm");
  const songList = document.getElementById("arirangSongList");
  const successBox = document.getElementById("arirangSuccess");

  if (!form || !songList || !successBox) return;

  // ============================================
  // PERSONALIZACION RAPIDA: CANCIONES Y AUDIOS
  // Cambia title y audioSrc segun tu evento real
  // ============================================
  const songs = [
    { id: "song-1", title: "Body to Body", fileName: "Body to Body - BTS.mp3" },
    { id: "song-2", title: "Hooligan", fileName: "Hooligan - BTS.mp3" },
    { id: "song-3", title: "Aliens", fileName: "Aliens - BTS.mp3" },
    { id: "song-4", title: "FYA", fileName: "FYA - BTS.mp3" },
    { id: "song-5", title: "2.0", fileName: "2.0 - BTS.mp3" },
    { id: "song-6", title: "No. 29", fileName: "No. 29 - BTS.mp3" },
    { id: "song-7", title: "SWIM", fileName: "SWIM - BTS.mp3" },
    { id: "song-8", title: "Merry Go Round", fileName: "Merry Go Round - BTS.mp3" },
    { id: "song-9", title: "NORMAL", fileName: "NORMAL (Explicit Ver.) - BTS.mp3" },
    { id: "song-10", title: "Like Animals", fileName: "Like Animals - BTS.mp3" },
    { id: "song-11", title: "they don't know 'bout us", fileName: "they don't know 'bout us - BTS.mp3" },
    { id: "song-12", title: "One More Night", fileName: "One More Night - BTS.mp3" },
    { id: "song-13", title: "Please", fileName: "Please - BTS.mp3" },
    { id: "song-14", title: "Into the Sun", fileName: "Into the Sun - BTS.mp3" },
  ];

  // ============================================
  // PERSONALIZACION RAPIDA: ENDPOINT FUTURO
  // Cuando conectes backend, cambia esta URL
  // Ej: "/api/arirang-participation"
  // ============================================
  const SUBMIT_ENDPOINT = "/api/arirang-participation";

  let dragSourceId = null;
  let activeAudio = null;
  const audioCache = new Map();
  const getAudioSrc = (fileName) => `./audio/${encodeURIComponent(fileName)}`;

  const getAudio = (src) => {
    if (!audioCache.has(src)) {
      audioCache.set(src, new Audio(src));
    }
    return audioCache.get(src);
  };

  const stopActiveAudio = () => {
    if (!activeAudio) return;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
    songList.querySelectorAll(".arirang-audio-btn").forEach((btn) => {
      btn.textContent = "▶️ Escuchar clip";
      btn.setAttribute("aria-pressed", "false");
    });
  };

  const buildSongItem = (song) => {
    const li = document.createElement("li");
    li.className = "arirang-song-item";
    li.draggable = true;
    li.dataset.songId = song.id;

    li.innerHTML = `
      <div class="arirang-handle" aria-hidden="true" title="Arrastra para cambiar orden">⋮⋮</div>
      <div class="arirang-song-main">
        <p class="arirang-song-title">${song.title}</p>
        <button type="button" class="arirang-audio-btn" data-action="play" data-src="${getAudioSrc(
          song.fileName
        )}" aria-pressed="false">
          ▶️ Escuchar clip
        </button>
      </div>
      <div class="arirang-controls">
        <button type="button" class="arirang-action-btn" data-action="up" aria-label="Subir canción">↑</button>
        <button type="button" class="arirang-action-btn" data-action="down" aria-label="Bajar canción">↓</button>
      </div>
    `;

    li.addEventListener("dragstart", (event) => {
      dragSourceId = li.dataset.songId || null;
      event.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    li.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!dragSourceId || dragSourceId === li.dataset.songId) return;

      const sourceEl = songList.querySelector(`[data-song-id="${dragSourceId}"]`);
      if (!sourceEl) return;

      const currentRect = li.getBoundingClientRect();
      const shouldInsertBefore = event.clientY < currentRect.top + currentRect.height / 2;

      if (shouldInsertBefore) {
        songList.insertBefore(sourceEl, li);
      } else {
        songList.insertBefore(sourceEl, li.nextElementSibling);
      }
    });

    li.addEventListener("dragend", () => {
      dragSourceId = null;
    });

    return li;
  };

  const renderSongs = () => {
    songList.innerHTML = "";
    songs.forEach((song) => songList.appendChild(buildSongItem(song)));
  };

  const moveItem = (item, direction) => {
    if (!item) return;
    if (direction === "up" && item.previousElementSibling) {
      songList.insertBefore(item, item.previousElementSibling);
    }
    if (direction === "down" && item.nextElementSibling) {
      songList.insertBefore(item.nextElementSibling, item);
    }
  };

  const validateField = (fieldId, condition) => {
    const input = document.getElementById(fieldId);
    if (!input) return true;
    const wrapper = input.closest(".arirang-field");
    const isValid = condition(input.value.trim());
    wrapper?.classList.toggle("is-error", !isValid);
    return isValid;
  };

  const getOrderedSongs = () =>
    Array.from(songList.querySelectorAll(".arirang-song-item")).map((item, index) => {
      const songId = item.dataset.songId;
      const songData = songs.find((song) => song.id === songId);
      return {
        position: index + 1,
        id: songData?.id || "",
        title: songData?.title || "",
      };
    });

  const sendParticipation = async (payload) => {
    if (!SUBMIT_ENDPOINT) {
      // Simulacion local mientras no exista backend.
      console.log("[ARIRANG] Participacion preparada:", payload);
      return { ok: true };
    }

    const response = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("No se pudo enviar la participacion.");
    }

    return response.json().catch(() => ({ ok: true }));
  };

  songList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const item = button.closest(".arirang-song-item");

    if (action === "up") {
      moveItem(item, "up");
      return;
    }

    if (action === "down") {
      moveItem(item, "down");
      return;
    }

    if (action === "play") {
      const src = button.dataset.src;
      if (!src) return;

      const audio = getAudio(src);
      const isSameAudio = activeAudio === audio && !audio.paused;

      stopActiveAudio();
      if (isSameAudio) return;

      activeAudio = audio;
      button.textContent = "⏹️ Detener clip";
      button.setAttribute("aria-pressed", "true");

      audio.onended = () => {
        if (activeAudio === audio) {
          stopActiveAudio();
        }
      };
      audio.onerror = () => {
        console.error("[ARIRANG] No se pudo cargar el audio:", src);
      };

      try {
        await audio.play();
      } catch (error) {
        stopActiveAudio();
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    successBox.classList.remove("is-visible");

    const nameOk = validateField("arirangFullName", (value) => value.length >= 3);
    const emailOk = validateField("arirangEmail", (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );

    if (!nameOk || !emailOk) {
      return;
    }

    const payload = {
      name: document.getElementById("arirangFullName")?.value.trim() || "",
      email: document.getElementById("arirangEmail")?.value.trim() || "",
      songsOrder: getOrderedSongs(),
      createdAt: new Date().toISOString(),
    };

    try {
      await sendParticipation(payload);
      form.reset();
      stopActiveAudio();
      successBox.classList.add("is-visible");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      alert("No se pudo enviar. Intentalo de nuevo en unos segundos.");
    }
  });

  renderSongs();
})();
