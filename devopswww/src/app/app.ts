import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

type Availability = 'online' | 'offline' | 'unknown' | 'degraded';

interface Probe {
  name: string;
  lat: number;
  lng: number;
  offsetX?: number;
  offsetY?: number;
  area?: string;
  showInList?: boolean;
  url: string;
  ip: string;
  pingHost: string;
  contact: string;
}

interface PanelItem {
  key: string;
  label: string;
  url: string;
  ip: string;
  pingHost: string;
  contact: string;
  probeName?: string;
}

interface GroupedArea {
  area: string;
  members: Probe[];
  position: { x: number; y: number };
  isGrouped: boolean;
  title: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  sectionsExpanded = {
    sondy: true,
    riverbed: true,
    ibm: true
  };

  selectedProbe = 'Legionowo';
  expandedItemKey: string | null = null;
  detailsVisible = new Set<string>();
  openGroup: GroupedArea | null = null;

  pingChecksEnabled = true;
  probeStatus = new Map<string, Availability>();
  hostStatus = new Map<string, Availability>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly probes: Probe[] = [
    { name: 'Legionowo', lat: 52.4015, lng: 20.9261, offsetX: 0.25, offsetY: -0.55, url: 'https://legionowo.example.local', ip: '10.10.1.11', pingHost: '10.10.1.11', contact: 'noc-legionowo@example.local' },
    { name: 'Bydgoszcz', lat: 53.1235, lng: 18.0084, offsetX: -0.75, offsetY: -0.45, url: 'https://bydgoszcz.example.local', ip: '10.10.2.11', pingHost: '10.10.2.11', contact: 'noc-bydgoszcz@example.local' },
    { name: 'Wrocław', lat: 51.1079, lng: 17.0385, offsetX: -0.2, offsetY: 0.1, area: 'Wrocław', url: 'https://wroclaw.example.local', ip: '10.10.3.11', pingHost: '10.10.3.11', contact: 'noc-wroclaw@example.local' },
    { name: 'NetIM', lat: 51.1079, lng: 17.0385, offsetX: 0.95, offsetY: -0.9, area: 'Wrocław', showInList: false, url: 'https://netim.example.local', ip: '10.40.12.15', pingHost: '10.40.12.15', contact: 'noc-riverbed@example.local' },
    { name: 'NetProfiler', lat: 51.1079, lng: 17.0385, offsetX: 1.35, offsetY: -0.1, area: 'Wrocław', showInList: false, url: 'https://netprofiler.example.local', ip: '10.40.12.16', pingHost: '10.40.12.16', contact: 'noc-riverbed@example.local' },
    { name: 'Flow Gateway', lat: 51.1079, lng: 17.0385, offsetX: 0.9, offsetY: 0.85, area: 'Wrocław', showInList: false, url: 'https://flowgateway.example.local', ip: '10.40.12.17', pingHost: '10.40.12.17', contact: 'noc-riverbed@example.local' },
    { name: 'Portal', lat: 51.1079, lng: 17.0385, offsetX: -0.15, offsetY: -1.2, area: 'Wrocław', showInList: false, url: 'https://portal.example.local', ip: '10.40.12.18', pingHost: '10.40.12.18', contact: 'noc-riverbed@example.local' },
    { name: 'Kraków', lat: 50.0647, lng: 19.945, offsetX: 0.3, offsetY: 0.55, url: 'https://krakow.example.local', ip: '10.10.4.11', pingHost: '10.10.4.11', contact: 'noc-krakow@example.local' },
    { name: 'Gdynia', lat: 54.5189, lng: 18.5305, offsetX: -0.45, offsetY: -1.0, url: 'https://gdynia.example.local', ip: '10.10.5.11', pingHost: '10.10.5.11', contact: 'noc-gdynia@example.local' },
    { name: 'Rakowiecka', lat: 52.2157, lng: 21.0152, offsetX: 0.15, offsetY: -0.05, area: 'Warszawa', url: 'https://rakowiecka.example.local', ip: '10.10.6.11', pingHost: '10.10.6.11', contact: 'noc-warszawa@example.local' },
    { name: 'Wawelska', lat: 52.2166, lng: 20.9859, offsetX: -0.1, offsetY: 0.2, area: 'Warszawa', url: 'https://wawelska.example.local', ip: '10.10.7.11', pingHost: '10.10.7.11', contact: 'noc-warszawa@example.local' },
    { name: 'Radiowa', lat: 52.2578, lng: 20.9131, offsetX: -0.55, offsetY: 0.1, area: 'Warszawa', url: 'https://radiowa.example.local', ip: '10.10.8.11', pingHost: '10.10.8.11', contact: 'noc-warszawa@example.local' },
    { name: 'Opole', lat: 50.6751, lng: 17.9213, offsetX: 0.25, offsetY: 0.35, url: 'https://opole.example.local', ip: '10.10.9.11', pingHost: '10.10.9.11', contact: 'noc-opole@example.local' }
  ];

  readonly areaAnchors: Record<string, { lat: number; lng: number; offsetX?: number; offsetY?: number }> = {
    'Wrocław': { lat: 51.1079, lng: 17.0385, offsetX: 0.35, offsetY: -0.15 },
    'Warszawa': { lat: 52.2297, lng: 21.0122, offsetX: 0.25, offsetY: 0.1 }
  };

  readonly mapProjection = {
    north: 54.95,
    south: 49.05,
    west: 14.1,
    east: 24.2,
    paddingLeft: 7.5,
    paddingRight: 9.2,
    paddingTop: 6.4,
    paddingBottom: 8.5
  };

  readonly riverbedItems: PanelItem[] = [
    { key: 'riverbed-netim', label: 'Riverbed NetIM', url: 'https://netim.example.local', ip: '10.40.12.15', pingHost: '10.40.12.15', contact: 'noc-riverbed@example.local' },
    { key: 'riverbed-netprofiler', label: 'Riverbed NetProfiler', url: 'https://netprofiler.example.local', ip: '10.40.12.16', pingHost: '10.40.12.16', contact: 'noc-riverbed@example.local' },
    { key: 'riverbed-flowgateway', label: 'Riverbed FlowGateway', url: 'https://flowgateway.example.local', ip: '10.40.12.17', pingHost: '10.40.12.17', contact: 'noc-riverbed@example.local' },
    { key: 'riverbed-portal', label: 'Riverbed Portal', url: 'https://portal.example.local', ip: '10.40.12.18', pingHost: '10.40.12.18', contact: 'noc-riverbed@example.local' }
  ];

  readonly ibmItems: PanelItem[] = [
    { key: 'ibm-serwer', label: 'Serwer', url: 'https://tivoli.example.local', ip: '10.50.21.10', pingHost: '10.50.21.10', contact: 'noc-ibm@example.local' }
  ];

  ngOnInit(): void {
    this.initializeStatuses();
    this.refreshAvailability();
    this.refreshTimer = setInterval(() => {
      this.refreshAvailability();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  get probeLinks(): string[] {
    return this.sondyItems.map((item) => item.label);
  }

  get sondyItems(): PanelItem[] {
    return this.probes
      .filter((probe) => probe.showInList !== false)
      .map((probe) => ({
        key: `probe-${probe.name}`,
        label: probe.name,
        probeName: probe.name,
        url: probe.url,
        ip: probe.ip,
        pingHost: probe.pingHost,
        contact: probe.contact
      }));
  }

  get groupedAreas(): GroupedArea[] {
    const grouped = new Map<string, Probe[]>();

    this.probes.forEach((probe) => {
      const groupKey = probe.area || probe.name;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }

      grouped.get(groupKey)?.push(probe);
    });

    return Array.from(grouped.entries()).map(([area, members]) => {
      const anchor = this.areaAnchors[area] || members[0];
      return {
        area,
        members,
        position: this.projectProbePosition(anchor),
        isGrouped: members.length > 1,
        title: members.length > 1 ? `${area} (${members.length})` : members[0].name
      };
    });
  }

  toggleSection(section: keyof App['sectionsExpanded']): void {
    this.sectionsExpanded[section] = !this.sectionsExpanded[section];
  }

  onMapCanvasClick(): void {
    this.openGroup = null;
  }

  onMarkerActivate(group: GroupedArea, event?: Event): void {
    event?.stopPropagation();

    if (group.isGrouped) {
      if (this.openGroup?.area === group.area) {
        this.openGroup = null;
        return;
      }

      this.openGroup = group;
      return;
    }

    this.selectProbe(group.members[0].name);
  }

  onMarkerKeydown(group: GroupedArea, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.onMarkerActivate(group, event);
  }

  selectProbe(name: string): void {
    this.selectedProbe = name;
    this.openGroup = null;
  }

  isGroupActive(group: GroupedArea): boolean {
    return group.members.some((member) => member.name === this.selectedProbe);
  }

  onPanelItemClick(item: PanelItem): void {
    if (item.probeName) {
      this.selectProbe(item.probeName);
    }

    if (this.expandedItemKey === item.key) {
      this.expandedItemKey = null;
      this.detailsVisible.delete(item.key);
      return;
    }

    this.expandedItemKey = item.key;
  }

  toggleDetails(itemKey: string, event: MouseEvent): void {
    event.stopPropagation();

    if (this.detailsVisible.has(itemKey)) {
      this.detailsVisible.delete(itemKey);
      return;
    }

    this.detailsVisible.add(itemKey);
  }

  isDetailsVisible(itemKey: string): boolean {
    return this.detailsVisible.has(itemKey);
  }

  getAvailability(item: PanelItem): Availability {
    if (item.probeName) {
      return this.probeStatus.get(item.probeName) || 'unknown';
    }

    return this.hostStatus.get(item.pingHost) || 'unknown';
  }

  getMarkerStatusClass(group: GroupedArea): string {
    const status = this.getGroupStatus(group.members.map((member) => member.name));
    return `marker-status-${status}`;
  }

  private projectProbePosition(probe: { lat: number; lng: number; offsetX?: number; offsetY?: number }): { x: number; y: number } {
    const usableWidth = 100 - this.mapProjection.paddingLeft - this.mapProjection.paddingRight;
    const usableHeight = 100 - this.mapProjection.paddingTop - this.mapProjection.paddingBottom;
    const lngRatio = (probe.lng - this.mapProjection.west) / (this.mapProjection.east - this.mapProjection.west);
    const latRatio = (this.mapProjection.north - probe.lat) / (this.mapProjection.north - this.mapProjection.south);

    return {
      x: this.mapProjection.paddingLeft + (lngRatio * usableWidth) + (probe.offsetX || 0),
      y: this.mapProjection.paddingTop + (latRatio * usableHeight) + (probe.offsetY || 0)
    };
  }

  private getGroupStatus(memberNames: string[]): Availability {
    const states = memberNames.map((name) => this.probeStatus.get(name) || 'unknown');
    const onlineCount = states.filter((state) => state === 'online').length;
    const offlineCount = states.filter((state) => state === 'offline').length;
    const unknownCount = states.filter((state) => state === 'unknown').length;

    if (unknownCount === states.length) {
      return 'unknown';
    }

    if (onlineCount === states.length) {
      return 'online';
    }

    if (offlineCount === states.length) {
      return 'offline';
    }

    return 'degraded';
  }

  private initializeStatuses(): void {
    this.probes.forEach((probe) => {
      this.probeStatus.set(probe.name, 'unknown');
      this.hostStatus.set(probe.pingHost, 'unknown');
    });

    [...this.riverbedItems, ...this.ibmItems].forEach((item) => {
      this.hostStatus.set(item.pingHost, 'unknown');
    });
  }

  private async fetchPingStatus(host: string): Promise<boolean> {
    const payload = await firstValueFrom(
      this.http.get<{ online?: boolean }>(`/api/ping?host=${encodeURIComponent(host)}`)
    );
    return Boolean(payload?.online);
  }

  private async refreshAvailability(): Promise<void> {
    if (!this.pingChecksEnabled) {
      return;
    }

    const uniqueHosts = new Set<string>([
      ...this.probes.map((probe) => probe.pingHost),
      ...this.riverbedItems.map((item) => item.pingHost),
      ...this.ibmItems.map((item) => item.pingHost)
    ]);

    for (const host of uniqueHosts) {
      try {
        const isOnline = await this.fetchPingStatus(host);
        this.hostStatus.set(host, isOnline ? 'online' : 'offline');
      } catch {
        this.pingChecksEnabled = false;
        this.hostStatus.forEach((_value, key) => {
          this.hostStatus.set(key, 'unknown');
        });
        break;
      }
    }

    this.probes.forEach((probe) => {
      this.probeStatus.set(probe.name, this.hostStatus.get(probe.pingHost) || 'unknown');
    });
  }
}
