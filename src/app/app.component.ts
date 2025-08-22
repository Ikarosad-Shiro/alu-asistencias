import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { BackendPingService } from './services/backend-ping.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'alu-asistencias';

  private pingIntervalId?: ReturnType<typeof setInterval>;
  private overlayObserver?: MutationObserver;
  private appRootAriaObserver?: MutationObserver;

  constructor(private pingService: BackendPingService) {}

  // --- Tu ping al backend (igual que antes) ---
  ngOnInit(): void {
    this.ping();
    this.pingIntervalId = setInterval(() => this.ping(), 5 * 60 * 1000); // 🔁 cada 5 minutos
  }

  ngAfterViewInit(): void {
    // Parche global: mueve el foco al overlay al abrirse (evita el warning)
    this.installA11yOverlayFocusPatch();
    // Guard: si alguien marca <app-root aria-hidden="true">, suelta foco y llévalo al overlay
    this.installAppRootAriaGuard();
  }

  ngOnDestroy(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.overlayObserver?.disconnect();
    this.appRootAriaObserver?.disconnect();
  }

  private ping(): void {
    this.pingService.pingBackend().subscribe({
      next: () => console.log('💖 Angular: "Hola backend, ¿cómo estás?"'),
      error: () => console.warn('💔 Angular: "No pude hablar con el backend..."')
    });
  }

  /**
   * Observa cuando Angular Material añade un overlay (.cdk-overlay-pane),
   * suelta el foco del elemento de fondo y enfoca algo dentro del overlay
   * (o el propio pane con tabindex -1).
   */
  private installA11yOverlayFocusPatch() {
    const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

    const target = document.querySelector('.cdk-overlay-container') || document.body;
    this.overlayObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (!node.classList.contains('cdk-overlay-pane')) return;

          // Espera un tick para que el contenido exista
          setTimeout(() => {
            // 1) Quita foco del input que quedó atrás
            blurActive();

            // 2) Enfoca algo razonable dentro del overlay
            const focusable = this.findFocusableInside(node);
            if (focusable) {
              focusable.focus();
            } else {
              // Fallback: enfoca el pane (hazlo focusable)
              if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
              node.focus();
            }
          }, 0);
        });
      }
    });

    this.overlayObserver.observe(target, { childList: true, subtree: true });
  }

  /**
   * Observa cambios en aria-hidden de <app-root>. Si pasa a "true",
   * suelta el foco inmediatamente y trata de moverlo al overlay activo.
   */
  private installAppRootAriaGuard() {
    const appRoot = document.querySelector('app-root') as HTMLElement | null;
    if (!appRoot) return;

    const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

    this.appRootAriaObserver = new MutationObserver(() => {
      if (appRoot.getAttribute('aria-hidden') === 'true') {
        // Suelta el foco del fondo
        blurActive();

        // Intenta llevar el foco a un elemento del overlay activo
        const pane = document.querySelector('.cdk-overlay-pane') as HTMLElement | null;
        if (pane) {
          const focusable = this.findFocusableInside(pane);
          if (focusable) {
            focusable.focus();
          } else {
            if (!pane.hasAttribute('tabindex')) pane.setAttribute('tabindex', '-1');
            pane.focus();
          }
        }
      }
    });

    this.appRootAriaObserver.observe(appRoot, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  /**
   * Busca un elemento enfocable útil dentro de un contenedor: primero [cdkFocusInitial],
   * si no, inputs/botones/selects/textarea o cualquier [tabindex]:not(-1).
   */
  private findFocusableInside(root: HTMLElement): HTMLElement | null {
    const preferred = root.querySelector<HTMLElement>('[cdkFocusInitial]');
    if (preferred) return preferred;

    return root.querySelector<HTMLElement>(
      'input, button, [role="button"], select, textarea, a[href], ' +
      '[tabindex]:not([tabindex="-1"])'
    );
  }
}
