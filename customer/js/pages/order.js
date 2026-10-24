/* Order page: shows the receipt and status. Checks the store every 5 seconds, so the status updates
   as the admin moves the order along. */
(() => {
  const $ = (s) => document.querySelector(s);
  const id = new URLSearchParams(location.search).get('id');
  const money = (n) => '৳' + Math.round(n).toLocaleString('en-US');

  const FLOW = {
    pickup: ['new', 'preparing', 'ready', 'completed'],
    delivery: ['new', 'preparing', 'ready', 'out_for_delivery', 'completed'],
  };
  const LABEL = {
    new: 'Received',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for delivery',
    completed: 'Completed',
  };

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function render(o) {
    $('#ordRef').textContent = `Order ${o.receipt}`;

    const steps = $('#steps');
    steps.textContent = '';
    if (o.status !== 'cancelled') {
      const flow = FLOW[o.order_type] || FLOW.pickup;
      const at = flow.indexOf(o.status);
      flow.forEach((s, i) => {
        const cls = 'step' + (i < at ? ' done' : i === at ? ' current' : '');
        steps.append(make('li', cls, LABEL[s]));
      });
    }

    $('#ordMsg').textContent =
      o.status === 'cancelled' ? 'This order was cancelled. Please call us for details.'
      : o.status === 'completed' ? 'Thank you, and enjoy your meal.'
      : 'This page updates by itself as your order moves along.';

    const list = $('#ordItems');
    list.textContent = '';
    o.items.forEach((i) => {
      const li = make('li');
      li.append(make('span', '', `${i.qty} × ${i.name}`), make('span', '', money(i.line_total)));
      list.append(li);
    });

    const parts = [`Subtotal ${money(o.subtotal)}`, `Tax ${money(o.tax)}`];
    if (o.order_type === 'delivery') parts.push(`Delivery ${money(o.delivery_fee)}`);
    parts.push(`Total ${money(o.total)}`);
    $('#ordTotals').textContent = parts.join(' · ');

    $('#ordDetail').textContent =
      o.order_type === 'delivery'
        ? `Delivery to: ${o.address}`
        : `Pickup${o.pickup_time ? ' at ' + o.pickup_time : ''}`;
  }

  let timer = null;
  async function load() {
    if (!id) {
      $('#ordMsg').textContent = 'No order selected.';
      return;
    }
    const res = await KG.getOrder(id);
    if (res.error) {
      $('#ordMsg').textContent = res.error.message;
      return;
    }
    render(res.data);
    if (['completed', 'cancelled'].includes(res.data.status)) clearInterval(timer);
  }

  load();
  timer = setInterval(load, 5000);
})();