// ─── channel.Post: почтовое отделение — модуль рантайма (этап Б) ───────────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, stringArgument } from './runtime-shared';
import { RuntimeObjectState } from './runtime-state';
import { RuntimeChannelConnection } from './channel-service';

export function initializeChannelPost(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Post') return;

  obj.is_open = false;
  obj.on_message = null;
  obj.__channelConnection = null;
  state.channelPosts.push(obj);

  obj.open = contextFunction((name: unknown, file: string, line: number) => {
    const channelName = stringArgument(name, 'Post.open() name', file, line);
    if (channelName.trim() === '') {
      throw new IdylliumRuntimeError(file, line, 'Post.open() channel name must not be empty');
    }
    if (obj.is_open === true) {
      throw new IdylliumRuntimeError(file, line, 'Post.open() the post is already open — close() it before opening another channel');
    }
    const service = state.channelService;
    if (!service) {
      throw new IdylliumRuntimeError(file, line, 'Post.open() is not available in the console host — run the program in the Web IDE or VS Code, where running programs can hear each other');
    }
    // Письмо не обрабатывается прямо тут: оно ложится в ящик и доставляется
    // в GUI-такте — как клики и таймеры, в предсказуемый момент.
    obj.__channelConnection = service.connect(channelName, (text: unknown) => {
      if (obj.is_open === true) state.channelMailbox.push({ post: obj, text: String(text) });
    });
    obj.is_open = true;
  });

  obj.send = contextFunction((text: unknown, file: string, line: number) => {
    const message = stringArgument(text, 'Post.send() message', file, line);
    if (obj.is_open !== true) {
      throw new IdylliumRuntimeError(file, line, 'Post.send() the post is not open — call open(name) first');
    }
    (obj.__channelConnection as RuntimeChannelConnection).send(message);
  });

  obj.close = contextFunction(() => {
    closeChannelPost(obj);
  });

  obj.to_string = () => (obj.is_open === true ? 'channel.Post(open)' : 'channel.Post(closed)');
}

export function closeChannelPost(post: RuntimeObject): void {
  const connection = post.__channelConnection as RuntimeChannelConnection | null;
  post.is_open = false;
  post.__channelConnection = null;
  if (connection) connection.close();
}

/** Виджет внутрь себя или внутрь своего же ребёнка — дерево без конца.
 *  Раньше это роняло рантайм голым JS-стеком уже при показе окна. */
