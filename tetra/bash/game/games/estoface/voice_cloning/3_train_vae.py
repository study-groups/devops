#!/usr/bin/env python3
"""
3_train_vae.py - Train VAE on excitation patterns

Trains a Variational Autoencoder to learn compact representations of voice excitations.
"""

import argparse
import os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
import json
from tqdm import tqdm

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

class ExcitationDataset(Dataset):
    """Dataset of excitation patterns"""

    def __init__(self, data_file):
        data = np.load(data_file)

        self.samples = torch.FloatTensor(data['samples'])
        self.phonemes = data['phonemes']

        # Build phoneme vocabulary
        unique_phonemes = np.unique(self.phonemes)
        self.phoneme_to_idx = {p: i for i, p in enumerate(unique_phonemes)}
        self.idx_to_phoneme = {i: p for p, i in self.phoneme_to_idx.items()}

        # Convert phonemes to indices
        self.phoneme_indices = torch.LongTensor([
            self.phoneme_to_idx[p] for p in self.phonemes
        ])

        print(f"Loaded {len(self.samples)} samples")
        print(f"Phonemes: {len(self.phoneme_to_idx)}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return {
            'excitation': self.samples[idx].unsqueeze(0),  # (1, 160)
            'phoneme': self.phoneme_indices[idx]
        }

class ExcitationVAE(nn.Module):
    """Variational Autoencoder for excitation patterns"""

    def __init__(self, num_phonemes, latent_dim=32):
        super().__init__()

        self.latent_dim = latent_dim

        # Phoneme embedding
        self.phoneme_embed = nn.Embedding(num_phonemes, 64)

        # Encoder
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=5, stride=2, padding=2),  # 160 -> 80
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Conv1d(32, 64, kernel_size=5, stride=2, padding=2),  # 80 -> 40
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2),  # 40 -> 20
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(128 * 20, 256),
            nn.ReLU()
        )

        # Latent space (conditioned on phoneme)
        self.fc_mu = nn.Linear(256 + 64, latent_dim)
        self.fc_logvar = nn.Linear(256 + 64, latent_dim)

        # Decoder
        self.decoder_input = nn.Linear(latent_dim + 64, 128 * 20)

        self.decoder = nn.Sequential(
            nn.Unflatten(1, (128, 20)),
            nn.ConvTranspose1d(128, 64, kernel_size=5, stride=2, padding=2, output_padding=1),  # 20 -> 40
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.ConvTranspose1d(64, 32, kernel_size=5, stride=2, padding=2, output_padding=1),  # 40 -> 80
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.ConvTranspose1d(32, 1, kernel_size=5, stride=2, padding=2, output_padding=1),  # 80 -> 160
            nn.Tanh()
        )

    def encode(self, x, phoneme):
        """Encode excitation to latent distribution"""
        phoneme_emb = self.phoneme_embed(phoneme)
        h = self.encoder(x)
        h_cond = torch.cat([h, phoneme_emb], dim=1)
        mu = self.fc_mu(h_cond)
        logvar = self.fc_logvar(h_cond)
        return mu, logvar

    def reparameterize(self, mu, logvar):
        """Reparameterization trick"""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z, phoneme):
        """Decode latent vector to excitation"""
        phoneme_emb = self.phoneme_embed(phoneme)
        z_cond = torch.cat([z, phoneme_emb], dim=1)
        h = self.decoder_input(z_cond)
        return self.decoder(h)

    def forward(self, x, phoneme):
        mu, logvar = self.encode(x, phoneme)
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z, phoneme)
        return recon, mu, logvar

def vae_loss(recon, x, mu, logvar, beta=0.01):
    """VAE loss: reconstruction + KL divergence"""
    # Reconstruction loss
    recon_loss = F.mse_loss(recon, x, reduction='sum') / x.size(0)

    # KL divergence
    kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / x.size(0)

    return recon_loss + beta * kl_loss, recon_loss, kl_loss

def train_vae(model, dataloader, epochs, lr=1e-3, beta=0.01, save_dir='models'):
    """Train the VAE"""

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    save_path = Path(save_dir)
    save_path.mkdir(exist_ok=True)

    best_loss = float('inf')

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        total_recon = 0
        total_kl = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{epochs}")

        for batch in pbar:
            excitation = batch['excitation'].to(device)
            phoneme = batch['phoneme'].to(device)

            # Forward pass
            recon, mu, logvar = model(excitation, phoneme)

            # Loss
            loss, recon_loss, kl_loss = vae_loss(recon, excitation, mu, logvar, beta)

            # Backward
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += loss.item()
            total_recon += recon_loss.item()
            total_kl += kl_loss.item()

            pbar.set_postfix({
                'loss': f'{loss.item():.4f}',
                'recon': f'{recon_loss.item():.4f}',
                'kl': f'{kl_loss.item():.4f}'
            })

        avg_loss = total_loss / len(dataloader)
        avg_recon = total_recon / len(dataloader)
        avg_kl = total_kl / len(dataloader)

        print(f"Epoch {epoch+1}: Loss={avg_loss:.4f}, Recon={avg_recon:.4f}, KL={avg_kl:.4f}")

        scheduler.step(avg_loss)

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': avg_loss,
                'phoneme_to_idx': dataloader.dataset.phoneme_to_idx,
                'idx_to_phoneme': dataloader.dataset.idx_to_phoneme
            }
            torch.save(checkpoint, save_path / 'best_model.pth')
            print(f"✓ Saved best model (loss={best_loss:.4f})")

        # Save checkpoint every 10 epochs
        if (epoch + 1) % 10 == 0:
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': avg_loss,
                'phoneme_to_idx': dataloader.dataset.phoneme_to_idx,
                'idx_to_phoneme': dataloader.dataset.idx_to_phoneme
            }
            torch.save(checkpoint, save_path / f'checkpoint_epoch_{epoch+1}.pth')

    print(f"\n✓ Training complete!")
    print(f"✓ Best model saved to: {save_path / 'best_model.pth'}")
    print(f"\nNext step: python 4_generate_codebook.py --model {save_path / 'best_model.pth'}")

def main():
    parser = argparse.ArgumentParser(description='Train VAE on excitation patterns')
    parser.add_argument('--speaker', default='my_voice', help='Speaker name')
    parser.add_argument('--data-dir', default='training_data', help='Training data directory')
    parser.add_argument('--epochs', type=int, default=50, help='Number of epochs')
    parser.add_argument('--batch-size', type=int, default=64, help='Batch size')
    parser.add_argument('--lr', type=float, default=1e-3, help='Learning rate')
    parser.add_argument('--latent-dim', type=int, default=32, help='Latent dimension')
    parser.add_argument('--beta', type=float, default=0.01, help='KL weight')
    parser.add_argument('--save-dir', default='models', help='Model save directory')

    args = parser.parse_args()

    # Load dataset
    data_file = Path(args.data_dir) / args.speaker / 'training_data.npz'

    if not data_file.exists():
        print(f"Error: Training data not found: {data_file}")
        print(f"Run: python 2_extract_excitations.py --speaker {args.speaker}")
        return

    dataset = ExcitationDataset(data_file)
    dataloader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)

    # Create model
    model = ExcitationVAE(
        num_phonemes=len(dataset.phoneme_to_idx),
        latent_dim=args.latent_dim
    ).to(device)

    print(f"\nModel parameters: {sum(p.numel() for p in model.parameters()):,}")
    print(f"Training on: {device}")
    print()

    # Train
    train_vae(model, dataloader, args.epochs, args.lr, args.beta, args.save_dir)

if __name__ == '__main__':
    main()
