import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioSedeComponent } from './calendario-sede.component';

describe('CalendarioSedeComponent', () => {
  let component: CalendarioSedeComponent;
  let fixture: ComponentFixture<CalendarioSedeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarioSedeComponent]
    });
    fixture = TestBed.createComponent(CalendarioSedeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
