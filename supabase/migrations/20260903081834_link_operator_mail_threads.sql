create or replace function public.link_resend_email_message_thread()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  header_in_reply_to text;
  header_references text;
  parent_thread uuid;
begin
  if new.direction = 'inbound' and new.headers is not null then
    header_in_reply_to := coalesce(new.headers ->> 'in-reply-to', new.headers ->> 'In-Reply-To');
    header_references := coalesce(new.headers ->> 'references', new.headers ->> 'References');

    if new.in_reply_to is null and nullif(btrim(header_in_reply_to), '') is not null then
      new.in_reply_to := btrim(header_in_reply_to);
    end if;

    if coalesce(array_length(new.reference_message_ids, 1), 0) = 0
       and nullif(btrim(header_references), '') is not null then
      new.reference_message_ids := regexp_split_to_array(btrim(header_references), E'\\s+');
    end if;

    if new.in_reply_to is not null then
      select m.thread_id
      into parent_thread
      from public.resend_email_messages m
      where m.message_id = new.in_reply_to
        and m.resend_email_id <> new.resend_email_id
      order by m.updated_at desc
      limit 1;

      if parent_thread is not null then
        new.thread_id := parent_thread;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.link_resend_email_message_thread() from public, anon, authenticated;
grant execute on function public.link_resend_email_message_thread() to service_role;

drop trigger if exists link_resend_email_message_thread on public.resend_email_messages;
create trigger link_resend_email_message_thread
before insert or update of headers, in_reply_to, message_id
on public.resend_email_messages
for each row
execute function public.link_resend_email_message_thread();
