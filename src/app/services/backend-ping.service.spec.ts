import { TestBed } from '@angular/core/testing';

import { BackendPingService } from './backend-ping.service';

describe('BackendPingService', () => {
  let service: BackendPingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackendPingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
