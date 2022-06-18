delete from subscriptions;
delete from services;

insert into services(id, channel, url)
values 
    ('calculator', 'pg://calculator', 'http://localhost:3000'),
    ('counter', 'pg://calculator', 'http://localhost:3002');

insert into subscriptions(id, active, producer, consumer, path, streams, names, position)
values
    ('calc-count', true, 'calculator', 'counter', 'counter', '^Calculator-.*$', '.*', -1),
    ('count-calc', true, 'counter', 'calculator', 'stateless-counter', '^Calculator-.*$', '^Cleared$', -1);
