import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioTrabajadorVisualComponent } from './calendario-trabajador-visual.component';

describe('CalendarioTrabajadorVisualComponent', () => {
  let component: CalendarioTrabajadorVisualComponent;
  let fixture: ComponentFixture<CalendarioTrabajadorVisualComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarioTrabajadorVisualComponent]
    });
    fixture = TestBed.createComponent(CalendarioTrabajadorVisualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
