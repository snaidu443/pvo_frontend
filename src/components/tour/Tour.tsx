import { Icon } from '../common/Icon';
import { ref } from '../../engine/reference';
import { closeModal, openModal, toast } from '../../ui/overlay';

/** "Take a Tour" modal (six slides from reference data). */
export function openTour(index = 0) {
  const slides = ref().tour, i = Math.max(0, Math.min(index, slides.length - 1)), s = slides[i];
  const next = () => { if (i + 1 >= slides.length) { closeModal(); toast('Tour complete.'); } else openTour(i + 1); };
  openModal({
    title: 'Take a Tour',
    body: (
      <>
        <div className="tour-content">
          <div className="tour-illustration"><Icon name={s.icon} size={58} /></div>
          <div className="tour-copy">
            <span className="status red">STEP {i + 1} OF {slides.length}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="tour-points">
              {s.points.map(p => <div key={p} className="tour-point"><b>—</b><span>{p}</span></div>)}
            </div>
          </div>
        </div>
        <div className="tour-footer">
          <div className="tour-progress" aria-label="Tour progress">
            {slides.map((_, k) => <span key={k} className={`tour-dot ${k === i ? 'active' : ''}`} />)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" onClick={closeModal}>Skip tour</button>
            {i > 0 && <button className="button" onClick={() => openTour(i - 1)}>Previous</button>}
            <button className="button primary" onClick={next}>{i === slides.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </>
    )
  });
}
