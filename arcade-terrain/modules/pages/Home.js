/**
 * Home Page
 */

import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';
import { NoiseService } from '../services/noise/index.js';
import { NoiseCard } from '../components/NoiseCard/index.js';

export const HomePage = {
  _noiseCard: null,

  render() {
    return `
      <div class="page page-home">
        ${Header.render('/')}

        <main class="main">
          <div class="cabinet-wrapper">
            <div class="cabinet-card">
              <svg viewBox="0 0 252 52" aria-label="Pixeljam Arcade">
                <use href="#svg_arcade_logo"/>
              </svg>
            </div>
          </div>
        </main>

        ${Footer.render()}
      </div>
    `;
  },

  mount(container) {
    Header.mount(container);

    // Apply noise background to cabinet card
    const cabinet = container.querySelector('.cabinet-card');
    if (cabinet) {
      NoiseService.apply(cabinet, { preset: 'cabinet' });

      // Double-click to open NoiseCard CLI
      cabinet.addEventListener('dblclick', (e) => {
        e.preventDefault();

        // Remove existing card if any
        if (this._noiseCard) {
          this._noiseCard.destroy();
        }

        // Create new card attached to cabinet
        this._noiseCard = NoiseCard.attachTo(cabinet, {
          title: 'Cabinet Noise CLI',
          preset: 'cabinet'
        });
      });

      console.log('[HomePage] Cabinet noise applied, double-click to open CLI');
    }

    console.log('[HomePage] Mounted');
  },

  unmount() {
    if (this._noiseCard) {
      this._noiseCard.destroy();
      this._noiseCard = null;
    }
  }
};
