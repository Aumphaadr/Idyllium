// Узкий шов «просмотрщики → ядро»: рендерам нужно открыть файл по клику
// (ссылки Markdown) и узнать текущий открытый файл (актуальность асинхронного
// предпросмотра). Ядро регистрирует себя при старте — прямой импорт main
// из листа дал бы цикл (прецедент шва — ValueOperations в рантайме).

export const viewerHost = {
  openFile: (_file) => {},
  currentFile: () => '',
};

export function registerViewerHost(host) {
  viewerHost.openFile = host.openFile;
  viewerHost.currentFile = host.currentFile;
}
