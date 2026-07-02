class IndexCardElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._flipped = false
  }

  static get observedAttributes() {
    return ['question', 'answer', 'creator', 'tags', 'card-id']
  }

  attributeChangedCallback() {
    this.render()
  }

  connectedCallback() {
    this.render()
  }

  get question() {
    return this.getAttribute('question') || ''
  }
  set question(value) {
    this.setAttribute('question', value)
  }

  get answer() {
    return this.getAttribute('answer') || ''
  }
  set answer(value) {
    this.setAttribute('answer', value)
  }

  get creator() {
    return this.getAttribute('creator') || ''
  }
  set creator(value) {
    this.setAttribute('creator', value)
  }

  get cardId() {
    return this.getAttribute('card-id') || ''
  }
  set cardId(value) {
    this.setAttribute('card-id', value)
  }

  get tags() {
    try {
      return JSON.parse(this.getAttribute('tags') || '[]')
    } catch {
      return []
    }
  }
  set tags(value) {
    if (Array.isArray(value)) {
      this.setAttribute('tags', JSON.stringify(value))
    } else {
      this.setAttribute('tags', value)
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; }
        :host { display: block; font-family: Inter, -apple-system, sans-serif; }

        .card-wrapper {
          height: 13.75rem;
          perspective: 62.5rem;
          cursor: pointer;
          position: relative;
        }

        .card {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.5s ease;
          border-radius: 0.75rem;
        }

        .card.flipped { transform: rotateY(180deg); }

        .card-front, .card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 0.75rem;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .card-front {
          background: #ffffff;
          border: 1px solid rgba(60,60,60,0.12);
          color: #2c3e50;
        }

        .card-back {
          transform: rotateY(180deg);
          background: #f2f2f2;
          border: 1px solid rgba(60,60,60,0.12);
          align-items: center;
          justify-content: center;
          color: #2c3e50;
        }

        .card-creator { font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.5rem; }

        .card-question {
          font-size: 1.1rem;
          font-weight: 600;
          flex: 1;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .card-answer { font-size: 1.1rem; font-weight: 600; text-align: center; }

        .card-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: auto; }

        .tag-chip {
          background: #f2f2f2;
          border: 1px solid rgba(60,60,60,0.2);
          border-radius: 1.25rem;
          padding: 0.25rem 0.75rem;
          font-size: 0.8rem;
          color: #2c3e50;
        }

        .card-detail-btn {
          position: absolute;
          bottom: 0.75rem;
          right: 0.75rem;
          background: #4f8ef7;
          color: white;
          border: none;
          border-radius: 0.375rem;
          padding: 0.3rem 0.6rem;
          font-size: 0.75rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .card-wrapper:hover .card-detail-btn { opacity: 1; }

        @media (prefers-color-scheme: dark) {
          .card-front, .card-back {
            background: #222222;
            border-color: rgba(84,84,84,0.48);
            color: rgba(235,235,235,0.87);
          }
          .card-back { background: #282828; }
          .tag-chip {
            background: #282828;
            border-color: rgba(84,84,84,0.48);
            color: rgba(235,235,235,0.64);
          }
        }
      </style>

      <div class="card-wrapper">
        <div class="card ${this._flipped ? 'flipped' : ''}">
          <div class="card-front">
            <span class="card-creator">Ersteller: ${this.creator}</span>
            <p class="card-question">${this.question}</p>
            <div class="card-tags">
              ${this.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('')}
            </div>
          </div>
          <div class="card-back">
            <p class="card-answer">${this.answer}</p>
          </div>
        </div>
        <button class="card-detail-btn">Details</button>
      </div>
    `

    this.shadowRoot.querySelector('.card').addEventListener('click', () => {
      this._flipped = !this._flipped
      this.shadowRoot.querySelector('.card').classList.toggle('flipped', this._flipped)
    })

    this.shadowRoot.querySelector('.card-detail-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      document.dispatchEvent(
        new CustomEvent('index-card-detail', {
          detail: { cardId: this.cardId },
          bubbles: true,
          composed: true,
        }),
      )
    })
  }
}

customElements.define('index-card', IndexCardElement)
