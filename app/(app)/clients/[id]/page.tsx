import { ClientDetailView } from "@/components/clients/ClientDetailView";

export default async function ClientDetailPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  return <ClientDetailView clientId={id} />;
}
