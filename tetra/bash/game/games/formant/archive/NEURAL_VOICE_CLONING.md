# Neural Voice Cloning for Formant + CELP

## The Big Idea

Instead of hand-crafted LPC coefficients and excitation vectors, use a neural network to learn them from real voice samples. This can give you a George Clooney voice (or anyone else) with phoneme-level control.

## Architecture Options

### Option 1: Autoencoder for Excitation Extraction (Simplest)

```
Input: Audio waveform (10ms segments)
    ↓
[Encoder] → Latent Vector (160 dims)
    ↓
[Decoder] → Reconstructed Audio

Training:
- Extract 10ms segments from voice samples
- Train autoencoder to compress/reconstruct
- Excitation vectors = latent codes
- Build phoneme-specific codebook
```

**Pros:**
- Simple, works with small datasets
- Learns compact representations
- Can interpolate between phonemes

**Cons:**
- Doesn't explicitly model LPC/excitation separation
- May learn full waveform, not just excitation

### Option 2: VAE for Excitation Codebook (Better)

```
Input: 10ms audio + phoneme label
    ↓
[Encoder] → μ, σ (latent distribution)
    ↓
[Sample z] → Excitation vector
    ↓
[LPC Filter] → Audio output
    ↓
Loss: Reconstruction + KL divergence
```

**Why VAE?**
- Learns smooth latent space (good for morphing)
- Can generate new excitations by sampling
- Phoneme conditioning = learned per-phoneme distributions

**Training:**
```python
# Pseudocode
def train_vae_excitation(audio_segments, phoneme_labels):
    for audio, phoneme in zip(audio_segments, phoneme_labels):
        # Extract LPC coefficients from audio
        lpc = extract_lpc(audio, order=10)

        # Inverse filter to get excitation
        excitation = inverse_lpc_filter(audio, lpc)

        # Encode excitation
        mu, logvar = encoder(excitation, phoneme)

        # Sample latent vector
        z = reparameterize(mu, logvar)

        # Decode to excitation
        predicted_excitation = decoder(z, phoneme)

        # Filter through LPC
        predicted_audio = lpc_filter(predicted_excitation, lpc)

        # Loss
        recon_loss = mse(predicted_audio, audio)
        kl_loss = kl_divergence(mu, logvar)
        loss = recon_loss + beta * kl_loss
```

### Option 3: GAN for Voice Conversion (Most Powerful)

```
[Source Voice] → [Encoder] → Style Code
                      ↓
[Target Phoneme] → [Generator] → Excitation + LPC
                      ↓
                 [LPC Filter] → Generated Audio
                      ↓
            [Discriminator] ← Real Voice Samples
```

**Why GAN?**
- Learns perceptually realistic voice textures
- Can do voice conversion (your voice → Clooney's voice)
- Adversarial training = more natural sound

**Architecture:**
```
Generator:
  Input: [phoneme embedding (64) + noise (100)]
  → FC(256) → FC(512) → FC(256)
  → Split: Excitation(160) + LPC(10)

Discriminator:
  Input: [audio waveform (160 samples)]
  → Conv1D(64) → Conv1D(128) → Conv1D(256)
  → FC(256) → FC(1) [real/fake]
```

### Option 4: Diffusion Model (State-of-the-Art)

Like Stable Diffusion but for audio:

```
Start: Gaussian noise
  ↓
[Denoising Network conditioned on phoneme]
  ↓ (iterative refinement)
Generate: Excitation pattern
  ↓
[LPC Filter] → High-quality audio
```

**Why Diffusion?**
- State-of-the-art quality (see WaveGrad, DiffWave)
- Very stable training
- Can generate extremely natural voices

## Practical Implementation Plan

### Phase 1: Data Collection (Week 1-2)

```bash
# 1. Download George Clooney interviews
youtube-dl "George Clooney interview" --extract-audio

# 2. Clean audio (remove music, background noise)
ffmpeg -i interview.mp3 -af "highpass=f=80,lowpass=f=8000" clean.wav

# 3. Segment into sentences
python segment_audio.py clean.wav

# 4. Force-align phonemes using Montreal Forced Aligner
mfa align segments/ lexicon.txt acoustic_model.zip output/

# Result: segments with phoneme timestamps
# segment_001.wav: [0.0-0.15s: 'h', 0.15-0.35s: 'e', ...]
```

### Phase 2: Extract Excitation Patterns (Week 3)

```python
import librosa
import numpy as np
from scipy import signal

def extract_training_data(audio_file, phoneme_alignments):
    """Extract excitation patterns for each phoneme"""
    y, sr = librosa.load(audio_file, sr=16000)

    training_data = []

    for phoneme, start, end in phoneme_alignments:
        # Extract segment
        segment = y[int(start*sr):int(end*sr)]

        # Compute LPC coefficients (10th order)
        lpc_coeffs = librosa.lpc(segment, order=10)

        # Inverse filter to get excitation
        excitation = signal.lfilter([1], lpc_coeffs, segment)

        # Chop into 10ms frames (160 samples @ 16kHz)
        for i in range(0, len(excitation)-160, 80):  # 50% overlap
            frame = excitation[i:i+160]
            training_data.append({
                'excitation': frame,
                'lpc': lpc_coeffs,
                'phoneme': phoneme,
                'speaker': 'clooney'
            })

    return training_data

# Process all audio
all_data = []
for audio_file in audio_files:
    alignments = load_alignments(audio_file)
    data = extract_training_data(audio_file, alignments)
    all_data.extend(data)

# Save dataset
np.save('clooney_excitations.npy', all_data)
```

### Phase 3: Train Neural Network (Week 4-5)

**Simple VAE Approach:**

```python
import torch
import torch.nn as nn

class ExcitationVAE(nn.Module):
    def __init__(self, phoneme_vocab_size=50, latent_dim=32):
        super().__init__()

        # Phoneme embedding
        self.phoneme_embed = nn.Embedding(phoneme_vocab_size, 64)

        # Encoder
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(128 * 160, 256),
            nn.ReLU()
        )

        self.fc_mu = nn.Linear(256 + 64, latent_dim)
        self.fc_logvar = nn.Linear(256 + 64, latent_dim)

        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim + 64, 256),
            nn.ReLU(),
            nn.Linear(256, 128 * 160),
            nn.ReLU(),
            nn.Unflatten(1, (128, 160)),
            nn.ConvTranspose1d(128, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.ConvTranspose1d(64, 1, kernel_size=3, padding=1),
            nn.Tanh()
        )

    def encode(self, x, phoneme):
        phoneme_emb = self.phoneme_embed(phoneme)
        h = self.encoder(x)
        h_cond = torch.cat([h, phoneme_emb], dim=1)
        mu = self.fc_mu(h_cond)
        logvar = self.fc_logvar(h_cond)
        return mu, logvar

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z, phoneme):
        phoneme_emb = self.phoneme_embed(phoneme)
        z_cond = torch.cat([z, phoneme_emb], dim=1)
        return self.decoder(z_cond)

    def forward(self, x, phoneme):
        mu, logvar = self.encode(x, phoneme)
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z, phoneme)
        return recon, mu, logvar

# Training loop
def train_vae(model, dataloader, epochs=100):
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    for epoch in range(epochs):
        for batch in dataloader:
            excitation = batch['excitation']  # (batch, 1, 160)
            phoneme = batch['phoneme']         # (batch,)

            # Forward pass
            recon, mu, logvar = model(excitation, phoneme)

            # Loss
            recon_loss = nn.MSELoss()(recon, excitation)
            kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
            loss = recon_loss + 0.01 * kl_loss

            # Backward
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        print(f"Epoch {epoch}: Recon={recon_loss:.4f}, KL={kl_loss:.4f}")

    return model
```

### Phase 4: Generate Personalized Codebook (Week 6)

```python
# After training, generate codebook
def generate_personalized_codebook(model, phoneme_list):
    """Generate excitation codebook for each phoneme"""

    codebook = {}

    for phoneme_idx, phoneme_name in enumerate(phoneme_list):
        # Generate multiple variations
        variations = []

        for pitch_variant in ['low', 'mid', 'high']:
            # Sample from learned distribution
            z = torch.randn(1, 32) * pitch_scale[pitch_variant]
            phoneme_tensor = torch.tensor([phoneme_idx])

            # Generate excitation
            with torch.no_grad():
                excitation = model.decode(z, phoneme_tensor)

            variations.append({
                'name': f'{phoneme_name}_{pitch_variant}',
                'samples': excitation.squeeze().numpy(),
                'energy': np.sqrt(np.mean(excitation.numpy()**2))
            })

        codebook[phoneme_name] = variations

    # Export to C header
    export_codebook_to_c(codebook, 'clooney_codebook.h')
```

### Phase 5: Integration with Formant

```c
// Replace excitation_codebook.h with clooney_codebook.h
#include "clooney_codebook.h"

// Use same CELP engine, but with Clooney's excitations!
formant_celp_select_excitation(&engine->celp, phoneme, pitch);
```

## Minimal Viable Product (MVP)

**If you want to start TODAY with minimal complexity:**

```bash
# 1. Record yourself saying all phonemes (30 minutes)
./record_phonemes.sh

# 2. Extract excitations with simple script (1 hour)
python extract_excitations.py recordings/*.wav

# 3. Train simple autoencoder (2 hours on laptop GPU)
python train_simple_ae.py --epochs 100

# 4. Generate new codebook (5 minutes)
python generate_codebook.py --model checkpoint.pth

# 5. Replace codebook and rebuild (1 minute)
cp generated_codebook.h src/excitation_codebook.h
make

# 6. Test your personalized voice!
./demo_speech.sh
```

## Even Simpler: Transfer Learning

Instead of training from scratch, you could:

1. **Use existing TTS model** (Tacotron, FastSpeech)
2. **Extract mel-spectrograms** for your target voice
3. **Use Griffin-Lim** or **vocoder** to get waveforms
4. **Extract LPC + excitation** from the generated audio
5. **Build codebook** from that

This leverages pre-trained models and requires minimal data collection.

## Resources

**Pre-trained Models:**
- **Coqui TTS** - Open-source multi-speaker TTS
- **Resemblyzer** - Speaker embedding extraction
- **Real-Time Voice Cloning** - Full pipeline

**Tools:**
- **Montreal Forced Aligner (MFA)** - Phoneme alignment
- **Kaldi** - Speech recognition toolkit
- **Praat** - Phonetic analysis

**Datasets:**
- **VCTK** - Multi-speaker English
- **LibriTTS** - Expressive speech
- **LJSpeech** - Single speaker (good for testing)

## Next Steps for Formant

1. ✅ **Current**: Hand-crafted CELP working
2. 🎯 **Next**: Record personal voice samples
3. 🎯 **Then**: Train simple VAE on your voice
4. 🎯 **Future**: Multi-speaker model with style transfer

Want me to create the data collection and training scripts? I can build a simple VAE training pipeline that you could run on your own voice samples in a few hours!
