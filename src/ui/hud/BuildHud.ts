import type { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';
import { BUILDING_CATALOG } from '../../gameplay/buildings/BuildingCatalog';

export interface BuildHudActions {
  selectBuilding(id: string): void;
  selectRoad(): void;
  selectBulldoze(): void;
  rotate(): void;
  confirm(): void;
  cancel(): void;
}

/**
 * DOM-based construction toolbar (UI layer).
 *
 * Plain HTML buttons instead of an in-canvas GUI: crisp at any DPR,
 * free of GPU cost, natively touch-friendly, and styleable from
 * style.css. Emoji icons keep the project asset-free.
 *
 * The HUD only *sends* intents to the gameplay layer via the actions
 * interface and *listens* to EventBus state ('construction:…') — it
 * owns no game logic.
 */
export class BuildHud {
  private root: HTMLElement | null = null;
  private toolButtons = new Map<string, HTMLButtonElement>();
  private contextBar: HTMLElement | null = null;
  private confirmButton: HTMLButtonElement | null = null;
  private rotateButton: HTMLButtonElement | null = null;
  private readonly unsubscribes: (() => void)[] = [];

  constructor(
    private readonly actions: BuildHudActions,
    private readonly events: EventBus<GameEvents>,
  ) {}

  mount(parent: HTMLElement): void {
    const root = document.createElement('div');
    root.id = 'build-hud';

    // Contextual bar (rotate / confirm / cancel) sits above the toolbar.
    const context = document.createElement('div');
    context.className = 'hud-context';
    this.rotateButton = this.makeButton('hud-btn-rotate', '⟳', 'Rotate', () =>
      this.actions.rotate(),
    );
    this.confirmButton = this.makeButton('hud-btn-confirm', '✓', 'Confirm', () =>
      this.actions.confirm(),
    );
    this.confirmButton.classList.add('hud-confirm');
    const cancelButton = this.makeButton('hud-btn-cancel', '✕', 'Cancel', () =>
      this.actions.cancel(),
    );
    context.append(this.rotateButton, this.confirmButton, cancelButton);
    context.style.display = 'none';
    this.contextBar = context;

    // Main toolbar: one button per building, then road and bulldozer.
    const toolbar = document.createElement('div');
    toolbar.className = 'hud-toolbar';
    for (const def of BUILDING_CATALOG) {
      const button = this.makeButton(`hud-btn-${def.id}`, def.icon, def.name, () =>
        this.actions.selectBuilding(def.id),
      );
      this.toolButtons.set(`build:${def.id}`, button);
      toolbar.append(button);
    }
    const roadButton = this.makeButton('hud-btn-road', '🛣️', 'Road', () =>
      this.actions.selectRoad(),
    );
    this.toolButtons.set('road', roadButton);
    const dozerButton = this.makeButton('hud-btn-bulldoze', '🚜', 'Bulldoze', () =>
      this.actions.selectBulldoze(),
    );
    this.toolButtons.set('bulldoze', dozerButton);
    toolbar.append(roadButton, dozerButton);

    root.append(context, toolbar);
    parent.append(root);
    this.root = root;

    this.unsubscribes.push(
      this.events.on('construction:modeChanged', ({ mode, buildingId }) =>
        this.onModeChanged(mode, buildingId),
      ),
      this.events.on('construction:previewChanged', ({ active, valid }) => {
        if (this.confirmButton) {
          this.confirmButton.disabled = !(active && valid);
        }
      }),
    );
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
    this.root?.remove();
    this.root = null;
    this.toolButtons.clear();
  }

  private onModeChanged(mode: string, buildingId: string | null): void {
    const activeKey = mode === 'build' ? `build:${buildingId}` : mode;
    for (const [key, button] of this.toolButtons) {
      button.classList.toggle('active', key === activeKey);
    }
    if (this.contextBar) {
      this.contextBar.style.display = mode === 'view' ? 'none' : 'flex';
    }
    if (this.rotateButton) {
      this.rotateButton.style.display = mode === 'build' ? '' : 'none';
    }
    if (this.confirmButton) {
      this.confirmButton.style.display = mode === 'build' ? '' : 'none';
    }
  }

  private makeButton(
    id: string,
    icon: string,
    label: string,
    onPress: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.textContent = icon;
    button.addEventListener('click', onPress);
    return button;
  }
}
