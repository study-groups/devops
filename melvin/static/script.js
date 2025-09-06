document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('youtube-url');
  const getBtn = document.getElementById('get-transcript-btn');
  const transcriptOutput = document.getElementById('transcript-output');
  const errorMessage = document.getElementById('error-message');
  const loader = document.getElementById('loader');
  const copyBtn = document.getElementById('copy-btn');

  getBtn.addEventListener('click', fetchTranscript);
  urlInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') fetchTranscript(); });
  copyBtn.addEventListener('click', () => copyTranscriptToClipboard());

  function extractVideoID(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const m = url.match(regex);
    return m ? m[1] : null;
  }

  async function fetchTranscript() {
    const url = urlInput.value.trim();
    if (!url) return showError('Please enter a YouTube URL.');
    const videoID = extractVideoID(url);
    if (!videoID) return showError('Could not find a valid YouTube video ID in the URL.');
    resetUI(); loader.classList.remove('hidden');
    try {
      const response = await fetch(`/api/transcript?videoID=${videoID}&store=1`);
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error || 'Request failed');
      }
      const data = await response.json();
      transcriptOutput.textContent = data.transcript;
      copyBtn.classList.remove('hidden');
    } catch (err) {
      showError(err.message);
    } finally {
      loader.classList.add('hidden');
    }
  }

  function copyTranscriptToClipboard() {
    const text = transcriptOutput.textContent;
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 1500);
      });
    }
  }

  function showError(message) {
    resetUI();
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function resetUI() {
    errorMessage.classList.add('hidden');
    transcriptOutput.textContent = '';
    copyBtn.classList.add('hidden');
  }
});

