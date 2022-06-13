export const seed = (): string => `
create table if not exists public.services (
  id varchar(100) primary key,
  channel varchar(100) not null,
  url varchar(100) not null
) tablespace pg_default;

alter table public.services add column if not exists position integer not null default -1;
alter table public.services add column if not exists updated timestamptz not null default now();

create table if not exists public.subscriptions (
  id varchar(100) primary key,
  active boolean not null default true,
  producer varchar(100) not null,
  consumer varchar(100) not null,
  path varchar(100) not null,
  streams varchar(100) not null,
  names varchar(250) not null,
  position integer not null default -1,
  constraint fk_producer_service foreign key(producer) references services(id),
  constraint fk_consumer_service foreign key(consumer) references services(id)
) tablespace pg_default;

alter table public.subscriptions add column if not exists updated timestamptz not null default now();
alter table public.subscriptions add column if not exists batch_size int not null default 100;
alter table public.subscriptions add column if not exists retries int not null default 3;
alter table public.subscriptions add column if not exists retry_timeout_secs int not null default 10;

create or replace function notify() returns trigger as
$trigger$
declare
  rec record;
  payload text;
begin
  case TG_OP
    when 'UPDATE' then rec := NEW;
    when 'INSERT' then rec := NEW;
    when 'DELETE' then rec := OLD;
  end case;
  payload := json_build_object(
    'operation', TG_OP,
    'id', rec.id
  );
  perform pg_notify(TG_TABLE_NAME, payload);
  return rec;
end;
$trigger$ language plpgsql;

drop trigger if exists on_service_inserted_deleted on public.services;
create trigger on_service_inserted_deleted after INSERT or DELETE on public.services for each row
execute procedure public.notify();

drop trigger if exists on_service_updated on public.services;
create trigger on_service_updated after UPDATE on public.services for each row
when (
  (OLD.channel, OLD.url) is distinct from
  (NEW.channel, NEW.url)
)
execute procedure public.notify();

drop trigger if exists on_subscription_inserted_deleted on public.subscriptions;
create trigger on_subscription_inserted_deleted after INSERT or DELETE on public.subscriptions for each row
execute procedure public.notify();

drop trigger if exists on_subscription_updated on public.subscriptions;
create trigger on_subscription_updated after UPDATE on public.subscriptions for each row
when (
  (OLD.active, OLD.path, OLD.streams, OLD.names, OLD.batch_size, OLD.retries, OLD.retry_timeout_secs) is distinct from
  (NEW.active, NEW.path, NEW.streams, NEW.names, NEW.batch_size, NEW.retries, NEW.retry_timeout_secs)
)
execute procedure public.notify();
`;
