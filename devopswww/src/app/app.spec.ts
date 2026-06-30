import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render dashboard sections', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggleLabels = Array.from(compiled.querySelectorAll('.section-toggle')).map((el) => el.textContent?.trim());
    expect(toggleLabels).toContain('Sondy');
    expect(toggleLabels).toContain('Riverbed');
    expect(toggleLabels).toContain('IBM Tivoli');
  });
});
